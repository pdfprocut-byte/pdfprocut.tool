const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
let csrfToken;
let csrfRequest;
let sessionRequest;

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Authentication request failed.');
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload.data || {};
}

export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    csrfRequest = fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
      .then(readResponse)
      .then((data) => {
        csrfToken = data.csrfToken;
        return csrfToken;
      })
      .finally(() => { csrfRequest = null; });
  }
  return csrfRequest;
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrfToken();
  const response = await fetch(`${API_BASE}/${path.replace(/^\/+/, '')}`, {
    method,
    credentials: 'include',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  return readResponse(response);
}

export function authRequest(route, options) { return apiRequest(`auth/${route}`, options); }
export function getSession() {
  if (!sessionRequest) {
    sessionRequest = authRequest('session').finally(() => { sessionRequest = null; });
  }
  return sessionRequest;
}

export const adminRequest = (route, options) => apiRequest(`admin/${route}`, options);
export const apiBaseUrl = API_BASE;
export const fetchWithCredentials = (url, options = {}) => fetch(url, { ...options, credentials: 'include' });
