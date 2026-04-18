import './SearchBar.css';

function SearchBar() {
  return (
    <div className="search-bar">
      <input
        type="text"
        className="search-bar__input"
        placeholder="Search markets, symbols..."
        aria-label="Search markets and symbols"
      />
    </div>
  );
}

export default SearchBar;
