import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useLayout } from '../../../context/LayoutContext';
import Tooltip from '../../ui/Tooltip/Tooltip';
import WatchlistPanel from './WatchlistPanel';
import logoDark from '../../../assets/images/tradex-logo-dark.svg';
import logoLight from '../../../assets/images/tradex-logo-light.svg';
import iconDark from '../../../assets/images/tradex-icon-dark.svg';
import iconLight from '../../../assets/images/tradex-icon-light.svg';
import './Sidebar.css';

function Sidebar() {
  const { theme } = useTheme();
  const { sidebarCollapsed, toggleSidebar } = useLayout();
  const isDark = theme === 'dark';

  const itemClass = ({ isActive }) =>
    `sidebar__item${isActive ? ' sidebar__item--active' : ''}`;

  // Expanded, the nav items carry their own visible labels — a tooltip would
  // just repeat them.
  const navTip = (label, node) =>
    sidebarCollapsed ? <Tooltip label={label} placement="right">{node}</Tooltip> : node;

  return (
    <aside className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar__top">
        <Tooltip label="Trade X home" placement={sidebarCollapsed ? 'right' : 'bottom'}>
          <NavLink to="/" className="sidebar__logo-link" aria-label="Trade X home">
            <img
              src={sidebarCollapsed ? (isDark ? iconDark : iconLight) : (isDark ? logoDark : logoLight)}
              alt="Trade X"
              className="sidebar__logo"
            />
          </NavLink>
        </Tooltip>
        <Tooltip
          label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          placement={sidebarCollapsed ? 'right' : 'bottom'}
        >
          <button
            className="sidebar__collapse-btn"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </Tooltip>
      </div>

      <nav className="sidebar__nav">
        <span className="sidebar__section-label">Markets</span>

        {navTip('Home', (
          <NavLink to="/" end className={itemClass}>
            <LayoutDashboard size={20} className="sidebar__icon" />
            <span className="sidebar__item-label">Home</span>
          </NavLink>
        ))}

        {navTip('Picks', (
          <NavLink to="/picks" className={itemClass}>
            <Sparkles size={20} className="sidebar__icon" />
            <span className="sidebar__item-label">Picks</span>
          </NavLink>
        ))}
      </nav>

      <WatchlistPanel collapsed={sidebarCollapsed} />
    </aside>
  );
}

export default Sidebar;
