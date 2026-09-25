import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Star,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useLayout } from '../../../context/LayoutContext';
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

  return (
    <aside className={`sidebar${sidebarCollapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar__top">
        <NavLink to="/" className="sidebar__logo-link" aria-label="Trade X home">
          <img
            src={sidebarCollapsed ? (isDark ? iconDark : iconLight) : (isDark ? logoDark : logoLight)}
            alt="Trade X"
            className="sidebar__logo"
          />
        </NavLink>
        <button
          className="sidebar__collapse-btn"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          data-tooltip={sidebarCollapsed ? 'Expand' : 'Collapse'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="sidebar__nav">
        <span className="sidebar__section-label">Markets</span>

        <NavLink to="/" end className={itemClass} data-tooltip="Dashboard">
          <LayoutDashboard size={20} className="sidebar__icon" />
          <span className="sidebar__item-label">Dashboard</span>
        </NavLink>

        <NavLink to="/watchlist" className={itemClass} data-tooltip="Watchlist">
          <Star size={20} className="sidebar__icon" />
          <span className="sidebar__item-label">Watchlist</span>
        </NavLink>

        <NavLink to="/picks" className={itemClass} data-tooltip="Picks">
          <Sparkles size={20} className="sidebar__icon" />
          <span className="sidebar__item-label">Picks</span>
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
