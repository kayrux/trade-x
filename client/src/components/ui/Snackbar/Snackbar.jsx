import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import './Snackbar.css';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

function SnackbarItem({ id, message, variant, duration, onDismiss }) {
  // Owning the timer here means unmount cleanup is automatic, whether the item
  // was dismissed by hand or evicted by the visible cap. duration null = sticky.
  useEffect(() => {
    if (duration == null) return undefined;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const Icon = ICONS[variant] || Info;

  return (
    <div
      className={`snackbar snackbar--${variant}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <Icon className="snackbar__icon" size={16} aria-hidden="true" />
      <span className="snackbar__message">{message}</span>
      <button
        type="button"
        className="snackbar__close"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function SnackbarHost({ items, onDismiss }) {
  // Rendered unconditionally — an aria-live region has to pre-exist to be read.
  return (
    <div
      className="snackbar-host"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
    >
      {items.map((item) => (
        <SnackbarItem key={item.id} {...item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
