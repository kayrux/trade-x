import { useState } from 'react';
import { Home, User, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useSymbolSearch } from '../../../hooks/useSymbolSearch';
import SearchBar from '../../forms/SearchBar/SearchBar';
import SymbolSearchResults from '../../ui/SymbolSearchResults/SymbolSearchResults';
import './Navbar.css';

function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const { results, loading, error } = useSymbolSearch(query);
  const showDropdown = focused && query.trim().length > 0;

  return (
    <nav className="navbar">
      <div className="navbar__left">
        <button className="navbar__icon-btn" aria-label="Home">
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
          />
          <SymbolSearchResults
            results={results}
            loading={loading}
            error={error}
            visible={showDropdown}
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
