import { API_BASE_URL } from '../constants/index';

export const TOKEN_KEY = 'tradex_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private mode / blocked site data — treat as logged out.
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Non-fatal: the session just won't survive a reload.
  }
}

// Thrown so callers can distinguish "your token is bad" from other failures.
export class AuthError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

async function throwFromResponse(res, fallback) {
  const body = await res.json().catch(() => ({}));
  const message = body.error || `${fallback}: ${res.status}`;
  if (res.status === 401 || res.status === 403) {
    throw new AuthError(message, res.status);
  }
  throw new Error(message);
}

// Adds the Authorization header when a token is present. Used only for the
// admin-gated calls — public fetches stay on plain fetch.
export async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

export async function register({ email, username, password }) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });
  if (!res.ok) await throwFromResponse(res, 'Registration failed');
  return res.json(); // { token, user }
}

export async function login({ email, password }) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) await throwFromResponse(res, 'Login failed');
  return res.json(); // { token, user }
}

export async function fetchMe() {
  const res = await authFetch(`${API_BASE_URL}/auth/me`);
  if (!res.ok) await throwFromResponse(res, 'Session check failed');
  const { user } = await res.json();
  return user;
}
