import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  login as loginRequest,
  register as registerRequest,
  fetchMe,
  getToken,
  setToken,
} from '../lib/api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getToken());
  // Stays true until the initial /auth/me settles so protected UI doesn't
  // flash the logged-out state on a refresh.
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

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
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  function applySession({ token: newToken, user: newUser }) {
    setToken(newToken);
    setTokenState(newToken);
    setUser(newUser);
    return newUser;
  }

  async function login(credentials) {
    return applySession(await loginRequest(credentials));
  }

  async function register(details) {
    return applySession(await registerRequest(details));
  }

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAdmin: user?.is_admin === true,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
