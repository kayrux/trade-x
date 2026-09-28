import { API_BASE_URL } from '../constants/index';
import { authFetch, throwFromResponse } from './auth';

// Every /watchlists route requires auth and is scoped to the caller, so all of
// these go through authFetch. The server returns a watchlist as
// { id, name, is_public, created_at, symbols: ['AAPL', ...] } with symbols
// already in display order.

export async function fetchWatchlists() {
  const res = await authFetch(`${API_BASE_URL}/watchlists`);
  if (!res.ok) await throwFromResponse(res, 'Could not load watchlists');
  return res.json();
}

export async function createWatchlist(name) {
  const res = await authFetch(`${API_BASE_URL}/watchlists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) await throwFromResponse(res, 'Could not create watchlist');
  return res.json();
}

export async function renameWatchlist(id, name) {
  const res = await authFetch(`${API_BASE_URL}/watchlists/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) await throwFromResponse(res, 'Could not rename watchlist');
  return res.json();
}

export async function deleteWatchlist(id) {
  const res = await authFetch(`${API_BASE_URL}/watchlists/${id}`, { method: 'DELETE' });
  if (!res.ok) await throwFromResponse(res, 'Could not delete watchlist');
}

// Appends to the end of the list. Idempotent — adding a symbol that's already
// there returns the list unchanged.
export async function addWatchlistSymbol(id, symbol) {
  const res = await authFetch(`${API_BASE_URL}/watchlists/${id}/symbols`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) await throwFromResponse(res, 'Could not add symbol');
  return res.json();
}

export async function removeWatchlistSymbol(id, symbol) {
  const res = await authFetch(
    `${API_BASE_URL}/watchlists/${id}/symbols/${encodeURIComponent(symbol)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await throwFromResponse(res, 'Could not remove symbol');
}

// Full-array replace of the display order — the caller already holds the final
// arrangement after a drag, so there's no from/to for the server to reconcile.
export async function setWatchlistSymbolOrder(id, symbols) {
  const res = await authFetch(`${API_BASE_URL}/watchlists/${id}/symbols`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) await throwFromResponse(res, 'Could not reorder symbols');
  return res.json();
}
