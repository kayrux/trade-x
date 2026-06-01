import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, User, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useSymbolSearch } from '../../../hooks/useSymbolSearch';
import { useRecentSymbols } from '../../../hooks/useRecentSymbols';
import SearchBar from '../../forms/SearchBar/SearchBar';
import SymbolSearchResults from '../../ui/SymbolSearchResults/SymbolSearchResults';
import './Navbar.css';

function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
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

  return (
    <nav className="navbar">
      <div className="navbar__left">
        <button className="navbar__icon-btn" aria-label="Home" onClick={() => navigate('/')}>
          <Home size={22} />
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
        <button className="navbar__icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </button>
        <button className="navbar__icon-btn" aria-label="Account">
          <User size={22} />
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
