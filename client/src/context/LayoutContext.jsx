import { createContext, useContext, useState, useEffect } from 'react';

const LayoutContext = createContext(null);

const SIDEBAR_KEY = 'trade-x-sidebar-collapsed';

function readBool(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val === null ? fallback : val === 'true';
  } catch {
    return fallback;
  }
}

export function LayoutProvider({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readBool(SIDEBAR_KEY, false));

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed)); } catch { /* ignore */ }
  }, [sidebarCollapsed]);

  const toggleSidebar = () => setSidebarCollapsed((c) => !c);

  return (
    <LayoutContext.Provider value={{ sidebarCollapsed, toggleSidebar }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
