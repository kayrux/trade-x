import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import logoDark from '../../../assets/images/tradex-logo-dark.svg';
import logoLight from '../../../assets/images/tradex-logo-light.svg';
import { useSymbolSearch } from '../../../hooks/useSymbolSearch';
import { useRecentSymbols } from '../../../hooks/useRecentSymbols';
import SearchBar from '../../forms/SearchBar/SearchBar';
import SymbolSearchResults from '../../ui/SymbolSearchResults/SymbolSearchResults';
import './Navbar.css';

function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [recents, addRecentSymbol, clearRecentSymbols] = useRecentSymbols();
  const searchInputRef = useRef(null);

  const { results, loading, error } = useSymbolSearch(query);
  const hasQuery = query.trim().length > 0;
  const showDropdown = focused && (hasQuery || recents.length > 0);

  function handleSelect(result) {
    addRecentSymbol(result);
    navigate(`/dashboard?symbol=${result.symbol}`);
    setQuery('');
    setFocused(false);
    searchInputRef.current?.blur();
  }

  function handleAccountNav(path) {
    setAccountOpen(false);
    navigate(path);
  }

  function handleLogout() {
    setAccountOpen(false);
    logout();
    navigate('/');
  }

  return (
    <nav className="navbar">
      <div className="navbar__left">
        <button className="navbar__logo-btn" aria-label="Home" onClick={() => navigate('/')}>
          <img
            src={theme === 'dark' ? logoDark : logoLight}
            alt="Trade X"
            className="navbar__logo"
          />
        </button>
      </div>
      <div className="navbar__center">
        <div className="navbar__search-wrapper">
          <SearchBar
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onClear={() => setQuery('')}
            inputRef={searchInputRef}
          />
          <SymbolSearchResults
            results={hasQuery ? results : recents}
            loading={hasQuery ? loading : false}
            error={hasQuery ? error : null}
            isRecent={!hasQuery}
            visible={showDropdown}
            onSelect={handleSelect}
            onClearRecents={clearRecentSymbols}
          />
        </div>
      </div>
      <div className="navbar__right">
        <button className="navbar__nav-link" onClick={() => navigate('/picks')}>
          Picks
        </button>
        <button className="navbar__icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </button>
        <div className="navbar__account">
          <button
            className="navbar__icon-btn"
            aria-label="Account"
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            onClick={() => setAccountOpen((open) => !open)}
            // Same blur-delay trick the search dropdown uses, so a click on a
            // menu item lands before the menu unmounts.
            onBlur={() => setTimeout(() => setAccountOpen(false), 150)}
          >
            <User size={22} />
          </button>
          {accountOpen && (
            <div className="navbar__menu" role="menu">
              {user ? (
                <>
                  <div className="navbar__menu-header">{user.username}</div>
                  <button
                    className="navbar__menu-item"
                    role="menuitem"
                    onClick={() => handleAccountNav('/account')}
                  >
                    Account
                  </button>
                  <button
                    className="navbar__menu-item"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="navbar__menu-item"
                    role="menuitem"
                    onClick={() => handleAccountNav('/login')}
                  >
                    Log in
                  </button>
                  <button
                    className="navbar__menu-item"
                    role="menuitem"
                    onClick={() => handleAccountNav('/register')}
                  >
                    Create account
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
