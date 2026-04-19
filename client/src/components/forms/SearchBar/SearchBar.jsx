import './SearchBar.css';

function SearchBar({ value = '', onChange, onFocus, onBlur }) {
  return (
    <div className="search-bar">
      <input
        type="text"
        className="search-bar__input"
        placeholder="Search markets, symbols..."
        aria-label="Search markets and symbols"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  );
}

export default SearchBar;
