const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const API_ROOT = API_BASE_URL.replace(/\/api$/, '');

const buildHeaders = (token, extra = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...extra
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  const payload = contentType && contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message;
    throw new Error(message || 'Request failed');
  }
  return payload;
};

export const escrowApi = {
  login: async ({ role, password }) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, password })
    });
    return handleResponse(res);
  },
  getWallet: async (token) => {
    const res = await fetch(`${API_BASE_URL}/wallet`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  deposit: async (token, payload) => {
    const res = await fetch(`${API_BASE_URL}/wallet/deposit`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },
  transfer: async (token, payload) => {
    const res = await fetch(`${API_BASE_URL}/wallet/transfer`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },
  createEscrow: async (token, payload) => {
    const res = await fetch(`${API_BASE_URL}/escrows`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },
  getEscrows: async (token) => {
    const res = await fetch(`${API_BASE_URL}/escrows`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  getClientEscrows: async (token) => {
    const res = await fetch(`${API_BASE_URL}/escrows/client`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  getPublicEscrow: async (id) => {
    const res = await fetch(`${API_ROOT}/api/public/escrows/${id}`);
    return handleResponse(res);
  },
  updateEscrow: async (token, id, payload) => {
    const res = await fetch(`${API_BASE_URL}/escrows/${id}`, {
      method: 'PATCH',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },
  updateEscrowClient: async (token, id, payload) => {
    const res = await fetch(`${API_BASE_URL}/escrows/${id}/client`, {
      method: 'PATCH',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },
  getHistory: async (token) => {
    const res = await fetch(`${API_BASE_URL}/history`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  getNotifications: async (token) => {
    const res = await fetch(`${API_BASE_URL}/notifications`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  markNotificationRead: async (token, id) => {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'POST',
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  }
};
