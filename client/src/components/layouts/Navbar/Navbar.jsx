import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useRecentSymbols } from '../../../hooks/useRecentSymbols';
import { useSymbolSearch } from '../../../hooks/useSymbolSearch';
import SearchBar from '../../forms/SearchBar/SearchBar';
import SymbolSearchResults from '../../ui/SymbolSearchResults/SymbolSearchResults';
import './Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recents, addRecentSymbol, clearRecentSymbols] = useRecentSymbols();
  const searchInputRef = useRef(null);
  const accountRef = useRef(null);

  const { results, loading, error } = useSymbolSearch(query);
  const hasQuery = query.trim().length > 0;
  const showDropdown = focused && (hasQuery || recents.length > 0);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  function handleSelect(result) {
    addRecentSymbol(result);
    navigate(`/dashboard?symbol=${result.symbol}`);
    setQuery('');
    setFocused(false);
    searchInputRef.current?.blur();
  }

  return (
    <nav className="navbar">
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

      <div className="navbar__right">
        <button
          className="navbar__icon-btn"
          aria-label="Toggle theme"
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </button>

        <div className="navbar__account" ref={accountRef}>
          <button
            className="navbar__icon-btn"
            aria-label="Account"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <User size={22} />
          </button>
          {menuOpen && (
            <div className="navbar__account-menu" role="menu">
              <div className="navbar__account-header">
                <span className="navbar__avatar" aria-hidden="true">
                  <User size={18} />
                </span>
                <div className="navbar__account-info">
                  <span className="navbar__account-name">Account</span>
                  <span className="navbar__account-role">Signed in</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
