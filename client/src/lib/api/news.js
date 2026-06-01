import { API_BASE_URL } from '../constants';

export async function fetchNews(symbol) {
  const res = await fetch(`${API_BASE_URL}/news/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`Failed to fetch news: ${res.status}`);
  return res.json();
}

export async function fetchMarketNews() {
  const res = await fetch(`${API_BASE_URL}/news/market`);
  if (!res.ok) throw new Error(`Failed to fetch market news: ${res.status}`);
  return res.json();
}
