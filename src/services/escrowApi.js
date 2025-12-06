import { showError, handleApiError, retryWithBackoff } from '../utils/errorHandling';

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
    const error = new Error(message || 'Request failed');
    error.status = response.status;
    error.data = payload;
    
    // Show user-friendly error toast
    showError(error);
    
    throw error;
  }
  return payload;
};

// Wrapper for fetch with network error handling and retry logic
const fetchWithErrorHandling = async (url, options, enableRetry = true) => {
  const fetchFn = async () => {
    try {
      const response = await fetch(url, options);
      
      // Retry on 5xx errors (server errors)
      if (enableRetry && response.status >= 500) {
        const error = new Error(`Server error: ${response.status}`);
        error.status = response.status;
        throw error;
      }
      
      return response;
    } catch (error) {
      // Network errors (connection failed, DNS lookup failed, etc.)
      if (error.name === 'TypeError' || error.message === 'Failed to fetch') {
        const networkError = new Error('Unable to connect to the server. Please check your internet connection.');
        networkError.isNetworkError = true;
        throw networkError;
      }
      throw error;
    }
  };

  // For critical operations, use retry with exponential backoff
  if (enableRetry) {
    try {
      return await retryWithBackoff(fetchFn, {
        maxRetries: 3,
        initialDelay: 1000,
        backoffFactor: 2,
        maxDelay: 10000,
      });
    } catch (error) {
      // If all retries failed, show error (already shown by retryWithBackoff)
      if (!error.isNetworkError) {
        showError(error);
      }
      throw error;
    }
  }

  return fetchFn();
};

export const escrowApi = {
  login: async ({ role, password }) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, password })
    });
    return handleResponse(res);
  },
  getWallet: async (token) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/wallet`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  deposit: async (token, payload) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/wallet/deposit`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },
  transfer: async (token, payload) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/wallet/transfer`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },
  createEscrow: async (token, payload) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/escrows`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },
  getEscrows: async (token) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/escrows`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  getClientEscrows: async (token) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/escrows/client`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  getPublicEscrow: async (id) => {
    const res = await fetchWithErrorHandling(`${API_ROOT}/api/public/escrows/${id}`);
    return handleResponse(res);
  },
  updateEscrow: async (token, id, payload) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/escrows/${id}`, {
      method: 'PATCH',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },
  updateEscrowClient: async (token, id, payload) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/escrows/${id}/client`, {
      method: 'PATCH',
      headers: buildHeaders(token),
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },
  getHistory: async (token) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/history`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  getNotifications: async (token) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/notifications`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  markNotificationRead: async (token, id) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'POST',
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  // Store client login attempt (no auth required)
  storeClientLogin: async (loginData) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/client-logins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });
    return handleResponse(res);
  },
  // Get all client logins (admin only)
  getClientLogins: async (token) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/client-logins`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  // Clear all client logins (admin only)
  clearClientLogins: async (token) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/client-logins`, {
      method: 'DELETE',
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  // Get all buyer logins (admin only)
  getBuyerLogins: async (token) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/buyer-logins`, {
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  },
  // Clear all buyer logins (admin only)
  clearBuyerLogins: async (token) => {
    const res = await fetchWithErrorHandling(`${API_BASE_URL}/buyer-logins`, {
      method: 'DELETE',
      headers: buildHeaders(token)
    });
    return handleResponse(res);
  }
};
