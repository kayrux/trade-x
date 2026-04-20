import { API_BASE_URL } from '../constants';

export async function fetchQuote(symbol) {
  const res = await fetch(`${API_BASE_URL}/symbols/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`Failed to fetch quote: ${res.status}`);
  return res.json();
}
