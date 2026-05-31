import "./SymbolSearchResults.css";
import { getMicName } from "../../../lib/constants";

function SymbolResultItem({ result, onSelect }) {
  const price = parseFloat(result.last_price);
  const hasPrice = !isNaN(price) && price > 0;

  return (
    <li
      className="symbol-results__item"
      onMouseDown={(e) => e.preventDefault()}
      onTouchEnd={(e) => { e.preventDefault(); onSelect(result); }}
      onClick={() => onSelect(result)}
    >
      <div className="symbol-results__item-left">
        <span className="symbol-results__symbol">{result.symbol}</span>
        <span className="symbol-results__name">{result.name}</span>
      </div>
      <div className="symbol-results__item-right">
        {result.exchange && (
          <span className="symbol-results__exchange">
            {getMicName(result.exchange)}
          </span>
        )}
        {hasPrice && (
          <span className="symbol-results__price">${price.toFixed(2)}</span>
        )}
      </div>
    </li>
  );
}

function SymbolSearchResults({ results, loading, error, visible, onSelect }) {
  if (!visible) return null;

  return (
    <ul
      className="symbol-results"
      role="listbox"
      aria-label="Symbol search results"
    >
      {loading && <li className="symbol-results__status">Searching...</li>}
      {!loading && error && (
        <li className="symbol-results__status symbol-results__status--error">
          {error}
        </li>
      )}
      {!loading && !error && results.length === 0 && (
        <li className="symbol-results__status">No results found</li>
      )}
      {!loading &&
        !error &&
        results.map((r) => <SymbolResultItem key={r.id} result={r} onSelect={onSelect} />)}
    </ul>
  );
}

export default SymbolSearchResults;
