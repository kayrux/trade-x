import { API_BASE_URL } from '../constants';

export async function fetchCandles(symbol, resolution = 'daily', from = null, to = null) {
  const params = new URLSearchParams({ resolution });
  if (from) params.set('from', from);
  if (to)   params.set('to', to);

  const res = await fetch(`${API_BASE_URL}/candles/${encodeURIComponent(symbol)}?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch candles: ${res.status}`);
  return res.json();
}
