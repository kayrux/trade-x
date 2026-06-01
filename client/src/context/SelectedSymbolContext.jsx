import { createContext, useContext, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const SelectedSymbolContext = createContext(null);

export function SelectedSymbolProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const ticker = searchParams.get('symbol');
  const selectedSymbol = ticker ? { symbol: ticker } : null;

  const setSelectedSymbol = useCallback((result) => {
    setSearchParams(result ? { symbol: result.symbol } : {}, { replace: true });
  }, [setSearchParams]);

  return (
    <SelectedSymbolContext.Provider value={{ selectedSymbol, setSelectedSymbol }}>
      {children}
    </SelectedSymbolContext.Provider>
  );
}

export function useSelectedSymbol() {
  return useContext(SelectedSymbolContext);
}
