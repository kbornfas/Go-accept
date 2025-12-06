import toast from 'react-hot-toast';

/**
 * Centralized error handling and user-friendly error messages
 */

// Error type mappings
const ERROR_MESSAGES = {
  // Authentication errors
  'Invalid credentials': 'The email or password you entered is incorrect. Please try again.',
  'Invalid or expired token': 'Your session has expired. Please log in again.',
  'Missing auth header': 'You need to be logged in to perform this action.',
  'Forbidden': 'You don\'t have permission to access this resource.',
  'Too many login attempts': 'Too many failed attempts. Please wait 15 minutes before trying again.',
  
  // Validation errors
  'Validation failed': 'Please check your input and try again.',
  'Email is required': 'Please enter your email address.',
  'Password is required': 'Please enter your password.',
  'Amount must be greater than 0': 'Please enter a valid amount greater than zero.',
  
  // Network errors
  'Failed to fetch': 'Unable to connect to the server. Please check your internet connection.',
  'Network request failed': 'Network error. Please check your connection and try again.',
  'NetworkError': 'Unable to reach the server. Please try again.',
  
  // Email errors
  'Email service not configured': 'Email service is temporarily unavailable. Please try again later.',
  'Failed to send email': 'We couldn\'t send the email. Please try again or contact support.',
  
  // Password reset errors
  'Token not found': 'This reset link is invalid or has already been used. Please request a new one.',
  'Token has expired': 'This reset link has expired. Please request a new password reset.',
  'Reset link has expired': 'This reset link has expired (valid for 1 hour). Please request a new one.',
  
  // Escrow errors
  'Escrow not found': 'The payment link you\'re looking for doesn\'t exist or has been deleted.',
  'Insufficient balance': 'Insufficient funds in your wallet. Please add funds first.',
  
  // Default errors
  'Internal Server Error': 'Something went wrong on our end. Please try again in a moment.',
  'Service Unavailable': 'Our service is temporarily unavailable. Please try again shortly.',
};

/**
 * Get user-friendly error message
 */
export const getUserFriendlyMessage = (error) => {
  // Extract error message
  let errorMessage = 'An unexpected error occurred. Please try again.';
  
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error?.message) {
    errorMessage = error.message;
  } else if (error?.error) {
    errorMessage = error.error;
  }

  // Check for exact matches
  if (ERROR_MESSAGES[errorMessage]) {
    return ERROR_MESSAGES[errorMessage];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // HTTP status code messages
  if (error?.status) {
    switch (error.status) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return 'You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 429:
        return 'Too many requests. Please slow down and try again.';
      case 500:
        return 'Server error. Our team has been notified. Please try again.';
      case 502:
      case 503:
        return 'Our service is temporarily unavailable. Please try again in a moment.';
      case 504:
        return 'Request timeout. Please try again.';
    }
  }

  // Return original message if no match found (but sanitized)
  return errorMessage.length > 100 
    ? 'An error occurred. Please try again or contact support.' 
    : errorMessage;
};

/**
 * Show error toast notification
 */
export const showError = (error, options = {}) => {
  const message = getUserFriendlyMessage(error);
  
  return toast.error(message, {
    duration: options.duration || 5000,
    position: options.position || 'top-right',
    style: {
      background: '#1e293b',
      color: '#f8fafc',
      border: '1px solid #ef4444',
      borderRadius: '0.5rem',
      padding: '16px',
    },
    iconTheme: {
      primary: '#ef4444',
      secondary: '#f8fafc',
    },
    ...options,
  });
};

/**
 * Show success toast notification
 */
export const showSuccess = (message, options = {}) => {
  return toast.success(message, {
    duration: options.duration || 3000,
    position: options.position || 'top-right',
    style: {
      background: '#1e293b',
      color: '#f8fafc',
      border: '1px solid #10b981',
      borderRadius: '0.5rem',
      padding: '16px',
    },
    iconTheme: {
      primary: '#10b981',
      secondary: '#f8fafc',
    },
    ...options,
  });
};

/**
 * Show info toast notification
 */
export const showInfo = (message, options = {}) => {
  return toast(message, {
    duration: options.duration || 3000,
    position: options.position || 'top-right',
    icon: 'ℹ️',
    style: {
      background: '#1e293b',
      color: '#f8fafc',
      border: '1px solid #3b82f6',
      borderRadius: '0.5rem',
      padding: '16px',
    },
    ...options,
  });
};

/**
 * Show warning toast notification
 */
export const showWarning = (message, options = {}) => {
  return toast(message, {
    duration: options.duration || 4000,
    position: options.position || 'top-right',
    icon: '⚠️',
    style: {
      background: '#1e293b',
      color: '#f8fafc',
      border: '1px solid #f59e0b',
      borderRadius: '0.5rem',
      padding: '16px',
    },
    ...options,
  });
};

/**
 * Show loading toast notification
 */
export const showLoading = (message, options = {}) => {
  return toast.loading(message, {
    position: options.position || 'top-right',
    style: {
      background: '#1e293b',
      color: '#f8fafc',
      border: '1px solid #6366f1',
      borderRadius: '0.5rem',
      padding: '16px',
    },
    ...options,
  });
};

/**
 * Dismiss a specific toast or all toasts
 */
export const dismissToast = (toastId) => {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
};

/**
 * Handle API errors with automatic toast notifications
 */
export const handleApiError = async (response) => {
  let errorData;
  
  try {
    errorData = await response.json();
  } catch {
    errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
  }

  const error = {
    status: response.status,
    message: errorData.message || errorData.error || response.statusText,
    data: errorData
  };

  showError(error);
  return error;
};

/**
 * Wrap async function with error handling and toast notifications
 */
export const withErrorHandling = (asyncFn, options = {}) => {
  return async (...args) => {
    const loadingToast = options.showLoading 
      ? showLoading(options.loadingMessage || 'Processing...')
      : null;

    try {
      const result = await asyncFn(...args);
      
      if (loadingToast) {
        dismissToast(loadingToast);
      }
      
      if (options.successMessage) {
        showSuccess(options.successMessage);
      }
      
      return result;
    } catch (error) {
      if (loadingToast) {
        dismissToast(loadingToast);
      }
      
      if (!options.silent) {
        showError(error);
      }
      
      if (options.onError) {
        options.onError(error);
      }
      
      throw error;
    }
  };
};

/**
 * Retry failed operations with exponential backoff
 */
export const retryWithBackoff = async (
  fn,
  options = {}
) => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    onRetry = null,
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelay * Math.pow(backoffFactor, attempt),
          maxDelay
        );
        
        if (onRetry) {
          onRetry(attempt + 1, maxRetries, delay);
        }
        
        showWarning(
          `Request failed. Retrying in ${(delay / 1000).toFixed(1)}s... (Attempt ${attempt + 1}/${maxRetries})`,
          { duration: delay }
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  showError(lastError || 'Operation failed after multiple retries');
  throw lastError;
};

export default {
  getUserFriendlyMessage,
  showError,
  showSuccess,
  showInfo,
  showWarning,
  showLoading,
  dismissToast,
  handleApiError,
  withErrorHandling,
  retryWithBackoff,
};
