import { API_BASE_URL } from '../constants/index';

export async function searchSymbols(q) {
  const res = await fetch(`${API_BASE_URL}/symbols?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}
