export const readLocalJSON = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`Failed to parse localStorage key: ${key}`, err);
    return fallback;
  }
};

export const writeLocalJSON = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Failed to persist localStorage key: ${key}`, err);
  }
};

export const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getCurrencyKey = (code = 'USD') => {
  if (!code || typeof code !== 'string') return 'USD';
  return code.trim().toUpperCase();
};
