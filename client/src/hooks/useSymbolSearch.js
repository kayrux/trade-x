import { useState, useEffect } from 'react';
import { searchSymbols } from '../lib/api/symbols';

export function useSymbolSearch(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query || !query.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const timerId = setTimeout(async () => {
      try {
        setResults(await searchSymbols(query.trim()));
      } catch (err) {
        setError(err.message || 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timerId);
  }, [query]);

  return { results, loading, error };
}
