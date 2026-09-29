import { API_BASE_URL } from '../constants/index';
import { authFetch, throwFromResponse } from './auth';

// Every /accounts route requires auth and is scoped to the caller. An account
// comes back as { id, name, type, created_at }.

export async function fetchAccounts() {
  const res = await authFetch(`${API_BASE_URL}/accounts`);
  if (!res.ok) await throwFromResponse(res, 'Could not load accounts');
  return res.json();
}

export async function createAccount({ name, type }) {
  const res = await authFetch(`${API_BASE_URL}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, type }),
  });
  if (!res.ok) await throwFromResponse(res, 'Could not create account');
  return res.json();
}

export async function updateAccount(id, data) {
  const res = await authFetch(`${API_BASE_URL}/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await throwFromResponse(res, 'Could not update account');
  return res.json();
}

export async function deleteAccount(id) {
  const res = await authFetch(`${API_BASE_URL}/accounts/${id}`, { method: 'DELETE' });
  if (!res.ok) await throwFromResponse(res, 'Could not delete account');
}
