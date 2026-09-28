import { X } from 'lucide-react';
import './SearchBar.css';

function SearchBar({
  value = '',
  onChange,
  onFocus,
  onBlur,
  onClear,
  inputRef,
  // Defaults match the navbar, the original caller; the manage dialog searches
  // for a narrower purpose and says so.
  placeholder = 'Search markets, symbols...',
  ariaLabel = 'Search markets and symbols',
}) {
  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        type="text"
        className="search-bar__input"
        placeholder={placeholder}
        aria-label={ariaLabel}
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
