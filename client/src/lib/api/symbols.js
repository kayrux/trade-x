import { API_BASE_URL } from '../constants/index';

export async function searchSymbols(q) {
  const res = await fetch(`${API_BASE_URL}/symbols?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

export async function fetchBatchQuotes(symbols) {
  const res = await fetch(`${API_BASE_URL}/symbols/batch?symbols=${symbols.map(encodeURIComponent).join(',')}`);
  if (!res.ok) throw new Error(`Batch fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchMarketIndices() {
  const res = await fetch(`${API_BASE_URL}/symbols/market-indices`);
  if (!res.ok) throw new Error(`Market indices fetch failed: ${res.status}`);
  return res.json();
}
