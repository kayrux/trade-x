import { API_BASE_URL } from '../constants/index';
import { authFetch, throwFromResponse } from './auth';

// Every /trades and /holdings route requires auth and is scoped to an account,
// so all of these go through authFetch. A trade comes back as
// { id, account_id, symbol, side, quantity, price, currency, traded_at, note,
// updated_at }; a holding as
// { symbol, quantity, avg_cost, realized_pnl, currency, updated_at }.

export async function fetchTrades(accountId, symbol = null) {
  const params = new URLSearchParams({ account_id: accountId });
  if (symbol) params.set('symbol', symbol);
  const res = await authFetch(`${API_BASE_URL}/trades?${params}`);
  if (!res.ok) await throwFromResponse(res, 'Could not load trades');
  return res.json();
}

export async function createTrade(data) {
  const res = await authFetch(`${API_BASE_URL}/trades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await throwFromResponse(res, 'Could not record trade');
  return res.json();
}

export async function updateTrade(id, data) {
  const res = await authFetch(`${API_BASE_URL}/trades/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await throwFromResponse(res, 'Could not update trade');
  return res.json();
}

export async function deleteTrade(id) {
  const res = await authFetch(`${API_BASE_URL}/trades/${id}`, { method: 'DELETE' });
  if (!res.ok) await throwFromResponse(res, 'Could not delete trade');
}

// includeFlat keeps fully-closed positions (quantity 0) in the result, so a
// per-symbol view can still show lifetime realized P&L on a name no longer held.
export async function fetchHoldings(accountId, { includeFlat = false } = {}) {
  const params = new URLSearchParams({ account_id: accountId });
  if (includeFlat) params.set('all', '1');
  const res = await authFetch(`${API_BASE_URL}/holdings?${params}`);
  if (!res.ok) await throwFromResponse(res, 'Could not load holdings');
  return res.json();
}
