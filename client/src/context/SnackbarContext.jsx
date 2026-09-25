import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import SnackbarHost from '../components/ui/Snackbar/Snackbar';

const SnackbarContext = createContext(null);

// A bounded stack rather than a queue: queueing would delay auth feedback behind
// an unrelated message's timer, and replacing would silently drop one.
const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 6000;

const VARIANTS = ['success', 'error', 'info'];

export function SnackbarProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  // Stable identity (empty deps + updater form). AuthProvider's callbacks and
  // its /auth/me effect depend on this — an unstable one would re-run them.
  const showSnackbar = useCallback((messageOrOptions) => {
    const options =
      typeof messageOrOptions === 'string' ? { message: messageOrOptions } : messageOrOptions;
    const { message, variant, duration } = options || {};

    const safeVariant = VARIANTS.includes(variant) ? variant : 'info';
    idRef.current += 1;
    const id = idRef.current;
    const item = {
      id,
      message,
      variant: safeVariant,
      duration:
        duration === undefined
          ? (safeVariant === 'error' ? ERROR_DURATION : DEFAULT_DURATION)
          : duration,
    };

    setItems((prev) => [...prev, item].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const dismissSnackbar = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // items deliberately stays out of the context value — otherwise every
  // useSnackbar() consumer (AuthProvider, so the whole tree) re-renders each
  // time a message appears or expires.
  const value = useMemo(
    () => ({ showSnackbar, dismissSnackbar }),
    [showSnackbar, dismissSnackbar],
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <SnackbarHost items={items} onDismiss={dismissSnackbar} />
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  // Throws rather than returning null: a missing provider would silently
  // swallow every message with no other signal.
  if (!context) throw new Error('useSnackbar must be used within a SnackbarProvider');
  return context;
}
