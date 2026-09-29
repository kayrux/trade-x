import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchAccounts,
  createAccount as createRequest,
  updateAccount as updateRequest,
  deleteAccount as deleteRequest,
} from '../lib/api/accounts';
import { useAuth } from './AuthContext';
import { useSnackbar } from './SnackbarContext';

// Investment accounts (TFSA, RRSP, Margin, …) live on the server, one set per
// user. Only the pointer to the account the trade panel is showing is local —
// a per-device UI preference, not data worth a round trip on every click.
const ACTIVE_KEY = 'trade-x-active-account';

const AccountContext = createContext(null);

function loadActiveId() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function storeActiveId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Non-fatal: the selection just won't survive a reload.
  }
}

export function AccountProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { showSnackbar } = useSnackbar();

  const [accounts, setAccounts] = useState([]);
  const [activeIdState, setActiveIdState] = useState(loadActiveId);
  const [loading, setLoading] = useState(true);

  const reportError = useCallback(
    (err, fallback) => {
      showSnackbar({ message: err?.message || fallback, variant: 'error' });
    },
    [showSnackbar],
  );

  // Load on sign-in, clear on sign-out. Keyed on the user id so switching
  // accounts refetches rather than showing the previous user's accounts.
  useEffect(() => {
    if (authLoading) return undefined;

    if (!user) {
      setAccounts([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    fetchAccounts()
      .then((data) => {
        if (!cancelled) setAccounts(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setAccounts([]);
        reportError(err, 'Could not load accounts');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, reportError]);

  const setActiveAccount = useCallback((id) => {
    setActiveIdState(id);
    storeActiveId(id);
  }, []);

  const createAccount = useCallback(
    async ({ name, type }, { activate = true } = {}) => {
      try {
        const created = await createRequest({ name, type });
        setAccounts((prev) => [...prev, created]);
        if (activate) setActiveAccount(created.id);
        return created;
      } catch (err) {
        reportError(err, 'Could not create account');
        return null;
      }
    },
    [setActiveAccount, reportError],
  );

  const renameAccount = useCallback(
    async (id, data) => {
      try {
        const updated = await updateRequest(id, data);
        setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
        return updated;
      } catch (err) {
        reportError(err, 'Could not update account');
        return null;
      }
    },
    [reportError],
  );

  const deleteAccount = useCallback(
    async (id) => {
      try {
        await deleteRequest(id);
        setAccounts((prev) => {
          const next = prev.filter((a) => a.id !== id);
          // Deleting the account on screen falls back to the first one left,
          // which may be none — a user with zero accounts is a valid state.
          if (activeIdState === id) setActiveAccount(next[0]?.id ?? null);
          return next;
        });
        return true;
      } catch (err) {
        reportError(err, 'Could not delete account');
        return false;
      }
    },
    [activeIdState, setActiveAccount, reportError],
  );

  // Land on the stored account when it still exists, else the first one.
  const activeAccount =
    accounts.find((a) => a.id === activeIdState) ?? accounts[0] ?? null;

  return (
    <AccountContext.Provider
      value={{
        accounts,
        activeAccount,
        activeId: activeAccount?.id ?? null,
        loading: loading || authLoading,
        signedIn: Boolean(user),
        setActiveAccount,
        createAccount,
        renameAccount,
        deleteAccount,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccounts() {
  return useContext(AccountContext);
}
