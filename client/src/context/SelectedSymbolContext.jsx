import { createContext, useContext, useState } from 'react';

const SelectedSymbolContext = createContext(null);

export function SelectedSymbolProvider({ children }) {
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  return (
    <SelectedSymbolContext.Provider value={{ selectedSymbol, setSelectedSymbol }}>
      {children}
    </SelectedSymbolContext.Provider>
  );
}

export function useSelectedSymbol() {
  return useContext(SelectedSymbolContext);
}
