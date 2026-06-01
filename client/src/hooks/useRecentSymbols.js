import { useState } from 'react';

const KEY = 'trade-x-recent-symbols';
const MAX = 8;

export function useRecentSymbols() {
  const [recents, setRecents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) ?? [];
    } catch {
      return [];
    }
  });

  function addRecentSymbol(symbol) {
    setRecents(prev => {
      const next = [symbol, ...prev.filter(s => s.id !== symbol.id)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearRecentSymbols() {
    setRecents([]);
    localStorage.removeItem(KEY);
  }

  return [recents, addRecentSymbol, clearRecentSymbols];
}
