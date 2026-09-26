import { useState, useRef, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

const GAP = 8;
const ESTIMATED_HEIGHT = 30; // enough to decide whether below still fits
const EDGE = 8;

// Renders into document.body with fixed coordinates, so scroll containers and
// `overflow: hidden` ancestors can't clip it. Takes a single DOM-element child
// and chains onto whatever handlers that child already has.
function Tooltip({ label, children }) {
  const triggerRef = useRef(null);
  const [pos, setPos] = useState(null);

  function show() {
    const el = triggerRef.current;
    if (!el || !label) return;
    const rect = el.getBoundingClientRect();
    const below = rect.bottom + GAP + ESTIMATED_HEIGHT <= window.innerHeight;
    setPos({
      x: Math.min(Math.max(rect.left + rect.width / 2, EDGE), window.innerWidth - EDGE),
      y: below ? rect.bottom + GAP : rect.top - GAP,
      above: !below,
    });
  }

  function hide() {
    setPos(null);
  }

  function chain(handler, own) {
    return (e) => {
      handler?.(e);
      own(e);
    };
  }

  const child = cloneElement(children, {
    // React 19 passes ref as an ordinary prop; forward the child's own.
    ref: (node) => {
      triggerRef.current = node;
      const ref = children.props.ref;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    onMouseEnter: chain(children.props.onMouseEnter, show),
    onMouseLeave: chain(children.props.onMouseLeave, hide),
    onFocus: chain(children.props.onFocus, show),
    onBlur: chain(children.props.onBlur, hide),
    // A click usually means the thing the tip described just happened.
    onClick: chain(children.props.onClick, hide),
  });

  return (
    <>
      {child}
      {pos && label && createPortal(
        <span
          className={`tooltip${pos.above ? ' tooltip--above' : ''}`}
          role="tooltip"
          style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
        >
          {label}
        </span>,
        document.body,
      )}
    </>
  );
}

export default Tooltip;
