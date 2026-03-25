/**
 * Authenticated fetch helper for CloudCLI plugins.
 * Reads the auth token from localStorage (same key as CloudCLI).
 */
export function apiFetch(url, options = {}) {
  const token = localStorage.getItem('auth-token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
}
