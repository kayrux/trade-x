import { API_BASE_URL } from '../constants/index';
import { authFetch, throwFromResponse } from './auth';

// Every /portfolio route requires auth and is scoped to the caller, so all of
// these go through authFetch. Values are already summed server-side; the client
// only formats them.

// { total_value, cost_basis, return_abs, return_pct, accounts: [...] }
export async function fetchPortfolioSummary() {
  const res = await authFetch(`${API_BASE_URL}/portfolio/summary`);
  if (!res.ok) await throwFromResponse(res, 'Could not load portfolio');
  return res.json();
}

// { range, series: [{ date, value }] } summed across all accounts
export async function fetchPortfolioHistory(range) {
  const params = new URLSearchParams({ range });
  const res = await authFetch(`${API_BASE_URL}/portfolio/history?${params}`);
  if (!res.ok) await throwFromResponse(res, 'Could not load portfolio history');
  return res.json();
}

// A missing/foreign account answers 404; surface it with a status the page can
// branch on (throwFromResponse only tags 401/403).
function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

// { account, summary, holdings: [...] } for one account
export async function fetchAccountDetails(accountId) {
  const res = await authFetch(`${API_BASE_URL}/portfolio/accounts/${accountId}`);
  if (res.status === 404) throw notFound('Account not found');
  if (!res.ok) await throwFromResponse(res, 'Could not load account');
  return res.json();
}

// { range, series: [{ date, value }] } for one account
export async function fetchAccountHistory(accountId, range) {
  const params = new URLSearchParams({ range });
  const res = await authFetch(`${API_BASE_URL}/portfolio/accounts/${accountId}/history?${params}`);
  if (res.status === 404) throw notFound('Account not found');
  if (!res.ok) await throwFromResponse(res, 'Could not load account history');
  return res.json();
}
