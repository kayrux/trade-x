import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as loginRequest,
  register as registerRequest,
  updateAvatar as updateAvatarRequest,
  fetchMe,
  getToken,
  setToken,
  AuthError,
} from '../lib/api/auth';
import { useSnackbar } from './SnackbarContext';

const AuthContext = createContext(null);

const SIGNED_OUT_MESSAGE = "You've been signed out";
const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please log in again.';
const signedInMessage = (u) => `Signed in as ${u.username}`;
const welcomeMessage = (u) => `Welcome to Trade X, ${u.username}`;

export function AuthProvider({ children }) {
  const { showSnackbar } = useSnackbar();
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getToken());
  // Stays true until the initial /auth/me settles so protected UI doesn't
  // flash the logged-out state on a refresh.
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  // Silent teardown. Kept separate from logout() so the stale-token path below
  // doesn't announce a sign-out the user never asked for.
  const clearSession = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    showSnackbar({ message: SIGNED_OUT_MESSAGE, variant: 'info' });
  }, [clearSession, showSnackbar]);

  // Validate a persisted token on mount. An expired or revoked token comes
  // back 401 here, which is what logs the stale session out.
  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((err) => {
        if (cancelled) return;
        clearSession();
        // Only a real auth failure means the session expired — a server-down
        // blip must not claim otherwise.
        if (err instanceof AuthError) {
          showSnackbar({ message: SESSION_EXPIRED_MESSAGE, variant: 'error' });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, clearSession, showSnackbar]);

  function applySession({ token: newToken, user: newUser }) {
    setToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
    return newUser;
  }

  async function login(credentials) {
    const nextUser = applySession(await loginRequest(credentials));
    showSnackbar({ message: signedInMessage(nextUser), variant: 'success' });
    return nextUser;
  }

  async function register(details) {
    const nextUser = applySession(await registerRequest(details));
    showSnackbar({ message: welcomeMessage(nextUser), variant: 'success' });
    return nextUser;
  }

  // Persist the chosen avatar and update the in-memory user. Errors propagate
  // so the caller can surface them; a bad token here is handled like elsewhere.
  async function updateAvatar(avatarKey) {
    const nextUser = await updateAvatarRequest(avatarKey);
    setUser(nextUser);
    return nextUser;
  }

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateAvatar,
    isAdmin: user?.is_admin === true,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
