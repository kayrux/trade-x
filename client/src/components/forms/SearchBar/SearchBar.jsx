import { X } from 'lucide-react';
import './SearchBar.css';

function SearchBar({ value = '', onChange, onFocus, onBlur, onClear, inputRef }) {
  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        type="text"
        className="search-bar__input"
        placeholder="Search markets, symbols..."
        aria-label="Search markets and symbols"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {value && onClear && (
        <button
          className="search-bar__clear"
          onClick={onClear}
          aria-label="Clear search"
          tabIndex={-1}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default SearchBar;
