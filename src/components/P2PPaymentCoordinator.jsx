import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Moon,
  Sun,
  Plus,
  Trash2,
  Clock,
  History,
  X,
  Share2,
  MessageCircle,
  Mail,
  Phone,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { getCurrencyKey } from '../utils/escrowUtils';
import { platforms } from '../data/platforms';
import { useAuth } from '../context/AuthContext.jsx';
import { escrowApi } from '../services/escrowApi';
import { NotificationCenter } from './NotificationCenter.jsx';
import BuyerLogin from './BuyerLogin.jsx';

const holdStatusMeta = {
  held: {
    label: 'Held in Escrow',
    description: 'Awaiting admin approval and seller confirmation',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200'
  },
  approved: {
    label: 'Approved for Release',
    description: 'Admin cleared funds, waiting for seller release',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
  },
  released: {
    label: 'Released to Seller',
    description: 'Funds have been transferred out of escrow',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
  },
  refunded: {
    label: 'Refunded to Buyer',
    description: 'Hold was canceled and funds returned',
    badge: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
  },
  disputed: {
    label: 'Dispute Under Review',
    description: 'Buyer flagged this hold for manual review',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200'
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Buyer cancelled the hold before release',
    badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
  }
};

// Expiration options
const expirationOptions = [
  { value: 0, label: 'No expiration' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 180, label: '3 hours' },
  { value: 360, label: '6 hours' },
  { value: 1440, label: '24 hours' }
];

const paymentMethodOptions = [
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY', 'INR', 'NGN', 'KES', 'ZAR', 'GHS', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF', 'MAD', 'EGP', 'AED', 'SAR', 'BRL', 'MXN', 'ARS', 'COP', 'CLP', 'PEN', 'PHP', 'IDR', 'MYR', 'SGD', 'THB', 'VND', 'KRW', 'HKD', 'TWD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RUB', 'UAH', 'TRY', 'ILS', 'PKR', 'BDT', 'LKR', 'NPR'],
    fields: [
      { name: 'accountName', label: 'Account Holder Name', placeholder: 'John Doe' },
      { name: 'accountNumber', label: 'Account Number / IBAN', placeholder: 'DE89 3704 0044 0532 0130 00' },
      { name: 'bankName', label: 'Bank Name', placeholder: 'Bank of America' },
      { name: 'swiftCode', label: 'SWIFT / BIC', placeholder: 'BOFAUS3N', optional: true },
      { name: 'routingNumber', label: 'Routing / Branch Number', placeholder: '026009593', optional: true }
    ]
  },
  {
    value: 'mobile_money',
    label: 'Mobile Money',
    currencies: ['KES', 'UGX', 'TZS', 'RWF', 'GHS', 'NGN', 'ZAR', 'ZMW', 'MWK', 'XOF', 'XAF', 'CDF', 'ETB', 'SOS', 'SDG', 'MAD', 'EGP', 'INR', 'PKR', 'BDT', 'PHP', 'IDR', 'MYR'],
    providers: [
      'M-Pesa (Safaricom)',
      'M-Pesa (Vodacom)',
      'Airtel Money',
      'MTN Mobile Money',
      'Orange Money',
      'Tigo Pesa',
      'EcoCash',
      'GCash',
      'GrabPay',
      'Paytm',
      'PhonePe',
      'bKash',
      'Nagad',
      'Wave',
      'Moov Money',
      'Telebirr',
      'Chipper Cash',
      'Opay',
      'PalmPay',
      'Paga',
      'Other'
    ],
    fields: [
      { name: 'provider', label: 'Provider', placeholder: 'Select provider', inputType: 'select' },
      { name: 'phoneNumber', label: 'Registered Phone Number', placeholder: '+254 700 000000' },
      { name: 'accountName', label: 'Account Name', placeholder: 'Jane Doe' }
    ]
  },
  {
    value: 'paypal',
    label: 'PayPal',
    currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'SGD', 'HKD', 'NZD', 'MXN', 'BRL', 'ILS', 'PHP', 'THB', 'TWD'],
    fields: [
      { name: 'email', label: 'PayPal Email', placeholder: 'buyer@example.com' }
    ]
  },
  {
    value: 'cashapp',
    label: 'Cash App',
    currencies: ['USD', 'GBP'],
    fields: [
      { name: 'cashtag', label: 'Cashtag', placeholder: '$username' },
      { name: 'accountName', label: 'Account Name', placeholder: 'John Doe', optional: true }
    ]
  },
  {
    value: 'wise',
    label: 'Wise (TransferWise)',
    currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'TRY', 'INR', 'MYR', 'PHP', 'IDR', 'THB', 'VND', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'NGN', 'KES', 'ZAR', 'GHS', 'UGX', 'TZS', 'MAD', 'EGP', 'AED', 'SAR', 'ILS', 'PKR', 'BDT', 'LKR', 'NPR'],
    fields: [
      { name: 'email', label: 'Wise Email', placeholder: 'wise@example.com' },
      { name: 'fullName', label: 'Full Name', placeholder: 'John Doe' },
      { name: 'reference', label: 'Reference (if any)', placeholder: 'Invoice 123', optional: true }
    ]
  },
  {
    value: 'upi',
    label: 'UPI (India)',
    currencies: ['INR'],
    fields: [
      { name: 'upiId', label: 'UPI ID', placeholder: 'name@bank' },
      { name: 'accountName', label: 'Account Name', placeholder: 'Rahul Sharma' }
    ]
  },
  {
    value: 'crypto_wallet',
    label: 'Crypto Wallet',
    currencies: ['USDT', 'USDC', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'LTC', 'AVAX', 'TRX', 'DAI', 'BUSD'],
    networks: ['ERC20 (Ethereum)', 'TRC20 (Tron)', 'BEP20 (BSC)', 'Solana', 'Polygon', 'Arbitrum', 'Optimism', 'Avalanche C-Chain', 'Bitcoin', 'Litecoin', 'Ripple', 'Cardano', 'Polkadot', 'Other'],
    fields: [
      { name: 'network', label: 'Network / Chain', placeholder: 'Select network', inputType: 'select' },
      { name: 'address', label: 'Wallet Address', placeholder: '0xabc123...' }
    ]
  },
  {
    value: 'other',
    label: 'Other / Custom',
    currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY', 'INR', 'NGN', 'KES', 'ZAR', 'GHS', 'Other'],
    fields: [
      { name: 'instructions', label: 'Payment Instructions', placeholder: 'Describe the payment method and instructions...', inputType: 'textarea' }
    ]
  }
];

const findPaymentMethod = (value) => paymentMethodOptions.find(option => option.value === value);

const getPaymentFieldLabel = (methodValue, fieldName) => {
  const method = findPaymentMethod(methodValue);
  if (!method) return fieldName;
  const field = method.fields.find(item => item.name === fieldName);
  return field ? field.label : fieldName;
};

const isMethodComplete = (entry) => {
  if (!entry || !entry.method) return false;
  const config = findPaymentMethod(entry.method);
  if (!config) return false;
  return config.fields.every(field => {
    if (field.optional) return true;
    const value = entry.fields?.[field.name];
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  });
};

export default function P2PPaymentCoordinator({ initialPlatform, onChangePlatform }) {
  const { tokens, login, logout, loadingRole, error: authError } = useAuth();
  const clientToken = tokens.client;
  const [darkMode, setDarkMode] = useState(false);
  const [platform, setPlatform] = useState(initialPlatform || '');
  const [paymentMethods, setPaymentMethods] = useState([{ id: 1, method: '', fields: {} }]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [notes, setNotes] = useState('');
  const [expirationMinutes, setExpirationMinutes] = useState(0);
  const [status, setStatus] = useState('pending');

  // UI states
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('create');
  const [showHistory, setShowHistory] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [sellerConfirmed, setSellerConfirmed] = useState(false);

  // Validation states
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Transaction history
  const [transactionHistory, setTransactionHistory] = useState([]);

  // Sync platform when initialPlatform changes
  useEffect(() => {
    if (initialPlatform) {
      setPlatform(initialPlatform);
    }
  }, [initialPlatform]);

  // Expiration countdown
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [walletBalances, setWalletBalances] = useState({});
  const [escrowHolds, setEscrowHolds] = useState([]);
  const [walletActivity, setWalletActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositCurrency, setDepositCurrency] = useState('USD');
  const [walletError, setWalletError] = useState('');
  const [walletMessage, setWalletMessage] = useState('');
  const [activeEscrowId, setActiveEscrowId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [clientPassword, setClientPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [publicEscrow, setPublicEscrow] = useState(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState('');
  const [buyerAuthenticated, setBuyerAuthenticated] = useState(false);
  const [creatingEscrow, setCreatingEscrow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadClientData = useCallback(async () => {
    if (!clientToken) return;
    setSyncing(true);
    try {
      const [walletRes, escrowsRes, historyRes, notificationsRes] = await Promise.all([
        escrowApi.getWallet(clientToken),
        escrowApi.getClientEscrows(clientToken),
        escrowApi.getHistory(clientToken),
        escrowApi.getNotifications(clientToken)
      ]);
      setWalletBalances(walletRes?.balances || {});
      setWalletActivity(walletRes?.activity || []);
      setEscrowHolds(escrowsRes || []);
      const shareBase = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
      setTransactionHistory((historyRes || []).map(entry => ({
        ...entry,
        link: entry.link || (entry.escrowId && shareBase ? `${shareBase}?escrowId=${entry.escrowId}` : entry.link)
      })));
      setNotifications(notificationsRes || []);
    } catch (error) {
      console.error('Failed to sync client data', error);
      setWalletError(error.message);
    } finally {
      setSyncing(false);
    }
  }, [clientToken]);

  const heldTotals = useMemo(() => {
    return escrowHolds.reduce((acc, hold) => {
      if (hold.status === 'held' || hold.status === 'approved' || hold.status === 'disputed') {
        const key = getCurrencyKey(hold.currency);
        acc[key] = (acc[key] || 0) + Number(hold.amount || 0);
      }
      return acc;
    }, {});
  }, [escrowHolds]);

  const currentEscrowHold = useMemo(() => {
    if (viewMode === 'view' && publicEscrow) return publicEscrow;
    if (!activeEscrowId) return null;
    return escrowHolds.find(hold => hold.id === activeEscrowId) || null;
  }, [escrowHolds, activeEscrowId, publicEscrow, viewMode]);

  const activeHeldHolds = useMemo(
    () => escrowHolds.filter(hold => ['held', 'approved', 'disputed'].includes(hold.status)),
    [escrowHolds]
  );
  const walletBalanceEntries = useMemo(() => Object.entries(walletBalances), [walletBalances]);
  const heldBalanceEntries = useMemo(() => Object.entries(heldTotals), [heldTotals]);

  const getAvailableBalanceForCurrency = useCallback((code) => {
    const key = getCurrencyKey(code);
    return walletBalances[key] || 0;
  }, [walletBalances]);

  const getHeldBalanceForCurrency = useCallback((code) => {
    const key = getCurrencyKey(code);
    return heldTotals[key] || 0;
  }, [heldTotals]);

  const handleDepositFunds = async () => {
    setWalletError('');
    const value = parseFloat(depositAmount);
    if (isNaN(value) || value <= 0) {
      setWalletError('Enter a valid deposit amount');
      return;
    }
    if (!clientToken) {
      setWalletError('Login required to deposit funds');
      return;
    }
    const currencyKey = getCurrencyKey(depositCurrency);
    try {
      await escrowApi.deposit(clientToken, { amount: value, currency: currencyKey, source: 'client-topup' });
      await loadClientData();
      setWalletMessage(`Deposited ${value.toFixed(2)} ${currencyKey} into escrow wallet.`);
      setDepositAmount('');
    } catch (error) {
      setWalletError(error.message);
    }
  };

  const handleClientLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    if (!clientPassword.trim()) {
      setLoginError('Password is required');
      return;
    }
    try {
      await login('client', clientPassword.trim());
      setClientPassword('');
      await loadClientData();
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleClientLogout = () => {
    logout('client');
    setWalletBalances({});
    setEscrowHolds([]);
    setWalletActivity([]);
    setTransactionHistory([]);
    setNotifications([]);
  };

  const handleDismissNotification = async (id) => {
    if (!clientToken) return;
    try {
      await escrowApi.markNotificationRead(clientToken, id);
      setNotifications(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to dismiss notification', error);
    }
  };

  const handleClientEscrowAction = async (holdId, nextStatus) => {
    if (!clientToken || !holdId) {
      setWalletError('Login required to manage holds');
      return;
    }
    setWalletError('');
    try {
      await escrowApi.updateEscrowClient(clientToken, holdId, { status: nextStatus });
      await loadClientData();
      setWalletMessage(nextStatus === 'cancelled' ? 'Escrow cancelled successfully.' : 'Dispute submitted to admin.');
    } catch (error) {
      setWalletError(error.message);
    }
  };

  const atLeastOneMethodComplete = paymentMethods.some(pm => {
    if (pm.method) {
      return isMethodComplete(pm);
    }
    if (typeof pm.details === 'string') {
      return pm.details.trim().length > 0;
    }
    return false;
  });

  const handleMethodChange = (id, value) => {
    setPaymentMethods(prev => prev.map(pm => (
      pm.id === id
        ? { id: pm.id, method: value, fields: {} }
        : pm
    )));
    setErrors(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (key.startsWith(`paymentMethod_${id}`)) {
          delete updated[key];
        }
      });
      return updated;
    });
  };

  const handleMethodFieldChange = (id, fieldName, fieldValue) => {
    setPaymentMethods(prev => prev.map(pm => (
      pm.id === id
        ? { ...pm, fields: { ...pm.fields, [fieldName]: fieldValue } }
        : pm
    )));
  };

  const applyEscrowPayload = useCallback((data) => {
    if (!data) return;
    setPlatform(data.platform || '');
    const fallbackMethods = [{ id: 1, method: data.method || '', type: data.type || '', details: data.paymentDetails || '', fields: data.fields || {} }];
    const normalizedMethods = (data.paymentMethods && data.paymentMethods.length ? data.paymentMethods : fallbackMethods)
      .map((pm, idx) => {
        if (pm.method) {
          return {
            id: pm.id ?? idx + 1,
            method: pm.method,
            fields: pm.fields || {}
          };
        }
        return {
          id: pm.id ?? idx + 1,
          method: '',
          type: pm.type || '',
          details: pm.details || data.paymentDetails || ''
        };
      });
    setPaymentMethods(normalizedMethods.length ? normalizedMethods : [{ id: 1, method: '', fields: {} }]);
    setAmount(typeof data.amount === 'number' ? data.amount.toString() : (data.amount || ''));
    setCurrency(data.currency || '');
    setNotes(data.notes || '');
    setStatus(data.status || 'pending');
    setActiveEscrowId(data.id || data.escrowId || null);
    setPublicEscrow(data);

    if (data.expiresAt) {
      const expiresAt = new Date(data.expiresAt).getTime();
      const now = Date.now();
      const remaining = Math.floor((expiresAt - now) / 1000);
      if (remaining <= 0) {
        setIsExpired(true);
        setTimeRemaining(0);
      } else {
        setTimeRemaining(remaining);
        setIsExpired(false);
      }
    } else {
      setIsExpired(false);
      setTimeRemaining(null);
    }
  }, []);

  const loadLegacyPaymentDetails = useCallback((id) => {
    try {
      const data = JSON.parse(atob(id));
      applyEscrowPayload(data);
    } catch (e) {
      console.error('Invalid link');
    }
  }, [applyEscrowPayload]);

  const loadPublicEscrow = useCallback(async (id) => {
    if (!id) return;
    setPublicLoading(true);
    setPublicError('');
    try {
      const data = await escrowApi.getPublicEscrow(id);
      applyEscrowPayload(data);
    } catch (error) {
      setPublicError(error.message);
    } finally {
      setPublicLoading(false);
    }
  }, [applyEscrowPayload]);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (clientToken && viewMode === 'create') {
      loadClientData();
    }
  }, [clientToken, viewMode, loadClientData]);

  useEffect(() => {
    if (!clientToken || viewMode !== 'create') return;
    const interval = setInterval(loadClientData, 15000);
    return () => clearInterval(interval);
  }, [clientToken, viewMode, loadClientData]);

  useEffect(() => {
    if (currency) {
      setDepositCurrency(currency.toUpperCase());
    }
  }, [currency]);

  useEffect(() => {
    if (!walletMessage) return;
    const timer = setTimeout(() => setWalletMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [walletMessage]);

  // Check URL for payment link on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const escrowIdFromQuery = params.get('escrowId');
    const legacyId = params.get('id');

    if (escrowIdFromQuery) {
      setViewMode('view');
      loadPublicEscrow(escrowIdFromQuery);
    } else if (legacyId) {
      setViewMode('view');
      loadLegacyPaymentDetails(legacyId);
    }
  }, [loadLegacyPaymentDetails, loadPublicEscrow]);

  // Expiration countdown timer
  useEffect(() => {
    if (viewMode !== 'view' || !timeRemaining) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [viewMode, timeRemaining]);

  // Validation
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!platform) {
      newErrors.platform = 'Please select a trading platform';
    }

    if (!atLeastOneMethodComplete) {
      newErrors.paymentMethods = 'At least one payment method with required details is required';
    }

    paymentMethods.forEach((pm, index) => {
      if (pm.method) {
        const config = findPaymentMethod(pm.method);
        if (!config) {
          newErrors[`paymentMethod_${index}_method`] = 'Please select a valid payment method';
          return;
        }
        config.fields.forEach(field => {
          const value = pm.fields?.[field.name];
          if (!field.optional && (!value || !value.trim())) {
            newErrors[`paymentMethod_${index}_${field.name}`] = `${field.label} is required`;
          }
        });
      } else if (pm.type && (!pm.details || !pm.details.trim())) {
        // Legacy validation fallback for older data still in history
        newErrors[`paymentMethod_${index}_details`] = 'Payment details are required when type is selected';
      }
    });

    if (amount && isNaN(parseFloat(amount))) {
      newErrors.amount = 'Please enter a valid number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [platform, paymentMethods, amount]);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Payment methods management
  const addPaymentMethod = () => {
    const currentIds = paymentMethods.map(pm => pm.id);
    const newId = currentIds.length ? Math.max(...currentIds) + 1 : 1;
    setPaymentMethods([...paymentMethods, { id: newId, method: '', fields: {} }]);
  };

  const removePaymentMethod = (id) => {
    if (paymentMethods.length > 1) {
      setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
    }
  };

  // Generate link
  const generateLink = async () => {
    if (!clientToken) {
      setWalletError('Login required to create new escrows');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setWalletError('Enter a valid payment amount greater than zero');
      return;
    }

    if (!platform) {
      setWalletError('Select a trading platform');
      return;
    }

    // Check that at least one payment method is added
    if (paymentMethods.length === 0) {
      setWalletError('Add at least one payment method');
      return;
    }

    // Validate all payment methods have required fields filled
    for (const pm of paymentMethods) {
      if (!pm.method) {
        setWalletError('Select a payment method for all entries');
        return;
      }
      
      if (pm.method === 'other') {
        if (!pm.details || pm.details.trim().length === 0) {
          setWalletError('Fill in payment details for all methods');
          return;
        }
      } else {
        // Get the payment method definition
        const methodDef = paymentMethodOptions.find(m => m.value === pm.method);
        if (methodDef && methodDef.fields) {
          // Check all required fields are filled
          for (const fieldDef of methodDef.fields) {
            if (!fieldDef.optional) {
              const fieldValue = pm.fields[fieldDef.name];
              if (!fieldValue || fieldValue.trim().length === 0) {
                setWalletError(`Fill in all required fields for ${methodDef.label}: ${fieldDef.label}`);
                return;
              }
            }
          }
        }
      }
    }

    const currencyKey = getCurrencyKey(currency || 'USD');
    const expiresAt = expirationMinutes > 0
      ? new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString()
      : null;

    // Prepare payment methods with all fields
    const preparedPaymentMethods = paymentMethods.map(pm => {
      if (pm.method === 'other') {
        return {
          id: pm.id,
          method: pm.method,
          details: pm.details
        };
      }
      return {
        id: pm.id,
        method: pm.method,
        fields: pm.fields
      };
    });

    setCreatingEscrow(true);
    setWalletError('');
    try {
      const newEscrow = await escrowApi.createEscrow(clientToken, {
        platform,
        paymentMethods: preparedPaymentMethods,
        amount: numericAmount,
        currency: currencyKey,
        notes: notes || '',
        expiresAt,
        timestamp: new Date().toISOString()
      });

      const shareLink = `${window.location.origin}${window.location.pathname}?escrowId=${newEscrow.id}`;
      setGeneratedLink(shareLink);
      setActiveEscrowId(newEscrow.id);
      setStatus('success');
      setWalletMessage('Payment link generated successfully!');
      await loadClientData();
    } catch (error) {
      console.error('Error creating escrow:', error);
      setWalletError(error.message || 'Failed to generate payment link');
    } finally {
      setCreatingEscrow(false);
    }
  };

  const copyToClipboard = (text = generatedLink) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPlatformUrl = () => {
    const platformData = platforms.find(p => p.value === platform);
    return platformData ? platformData.url : '#';
  };

  const getPlatformLabel = () => {
    const platformData = platforms.find(p => p.value === platform);
    return platformData ? platformData.label : platform;
  };

  const resetForm = () => {
    setPlatform('');
    setPaymentMethods([{ id: 1, method: '', fields: {} }]);
    setAmount('');
    setCurrency('');
    setNotes('');
    setGeneratedLink('');
    setViewMode('create');
    setErrors({});
    setTouched({});
    setExpirationMinutes(0);
    setSellerConfirmed(false);
    setIsExpired(false);
    setTimeRemaining(null);
    setActiveEscrowId(null);
    setStatus('pending');
    setWalletError('');
    setWalletMessage('');
    setPublicEscrow(null);
    setPublicError('');
    window.history.pushState({}, '', window.location.pathname);
  };

  // Sharing functions
  const shareViaWhatsApp = () => {
    const text = `Payment Request: ${amount} ${currency} via ${getPlatformLabel()}\n\n${generatedLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaTelegram = () => {
    const text = `Payment Request: ${amount} ${currency} via ${getPlatformLabel()}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(generatedLink)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = `Payment Request - ${amount} ${currency}`;
    const body = `Hello,\n\nPlease review and process the following payment request:\n\nPlatform: ${getPlatformLabel()}\nAmount: ${amount} ${currency}\n\nPayment Link: ${generatedLink}\n\nThank you!`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const shareViaSMS = () => {
    const text = `Payment Request: ${amount} ${currency} - ${generatedLink}`;
    window.open(`sms:?body=${encodeURIComponent(text)}`, '_blank');
  };

  // Format time remaining
  const formatTimeRemaining = (seconds) => {
    if (seconds <= 0) return 'Expired';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  // Delete history entry
  const deleteHistoryEntry = (id) => {
    setTransactionHistory(prev => prev.filter(entry => entry.id !== id));
  };

  // View mode - Buyer sees payment details (must login first)
  if (viewMode === 'view') {
    // Show buyer login before payment details
    if (!buyerAuthenticated && publicEscrow) {
      return (
        <BuyerLogin
          onSuccess={() => setBuyerAuthenticated(true)}
          selectedPlatform={publicEscrow.platform}
          escrowId={publicEscrow.id}
        />
      );
    }

    return (
      <div className={`min-h-screen transition-colors ${darkMode ? 'dark bg-gray-900' : 'bg-white'} p-6 relative`}>
        {/* Top gradient bar */}
        {!darkMode && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-violet-500 to-amber-500" />}
        
        <div className="max-w-2xl mx-auto pt-4">
          <div className={`rounded-2xl shadow-xl p-8 ${darkMode ? 'bg-gray-800' : 'bg-white border-2 border-slate-100'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'bg-gradient-to-r from-slate-800 via-violet-700 to-slate-800 bg-clip-text text-transparent'}`}>Payment Request</h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-600'}`}
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={resetForm}
                  className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                >
                  Create New
                </button>
              </div>
            </div>

            {publicError && (
              <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 mb-6 rounded">
                <p className="text-sm font-semibold text-red-700 dark:text-red-200">{publicError}</p>
                <p className="text-xs text-red-500 dark:text-red-300 mt-1">The link may be invalid or the escrow was removed.</p>
              </div>
            )}

            {publicLoading && (
              <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 mb-6">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <p className="text-sm text-indigo-700 dark:text-indigo-200">Loading escrow details...</p>
              </div>
            )}

            {/* Expiration Warning */}
            {isExpired && (
              <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 mb-6 rounded">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 dark:text-red-200 font-semibold">Link Expired</p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      This payment link has expired. Please contact the buyer for a new link.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Time Remaining */}
            {timeRemaining > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4 mb-6 rounded">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-yellow-500 mr-3" />
                  <div>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold">
                      Time Remaining: {formatTimeRemaining(timeRemaining)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentEscrowHold && (() => {
              const holdStatus = currentEscrowHold.status || 'held';
              const meta = holdStatusMeta[holdStatus] || holdStatusMeta.held;
              const isSuccess = holdStatus === 'released';
              const isInfo = holdStatus === 'approved';
              const isWarning = holdStatus === 'disputed';
              const isDanger = holdStatus === 'cancelled';
              const baseClass = isSuccess
                ? (darkMode ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200')
                : isInfo
                  ? (darkMode ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200')
                  : isWarning
                    ? (darkMode ? 'bg-orange-900/20 border border-orange-700' : 'bg-orange-50 border border-orange-200')
                    : isDanger
                      ? (darkMode ? 'bg-slate-900/40 border border-slate-700' : 'bg-slate-100 border border-slate-300')
                      : (darkMode ? 'bg-yellow-900/20 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200');
              const IconComponent = isSuccess ? CheckCircle : (isWarning || isDanger ? AlertTriangle : Clock);
              const iconClass = isSuccess
                ? 'text-green-500'
                : isInfo
                  ? 'text-blue-500'
                  : isWarning
                    ? 'text-orange-500'
                    : isDanger
                      ? 'text-slate-500'
                      : 'text-yellow-500';
              return (
                <div className={`flex items-start gap-3 mb-6 p-4 rounded-lg ${baseClass}`}>
                  <IconComponent className={`w-5 h-5 mt-0.5 ${iconClass}`} />
                  <div>
                    <p className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Escrow Status: {meta.label}
                    </p>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {meta.description}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Action Required Alert */}
            {!isExpired && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 mb-6 rounded">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold">Seller Action Required</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Please review the payment details below and login to your trading platform to release the cryptocurrency.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentEscrowHold && (
              <div className={`mb-6 p-4 rounded-lg border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-indigo-50 border-indigo-100'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${darkMode ? 'text-indigo-200' : 'text-indigo-800'}`}>Escrow Wallet</p>
                    <p className={`text-2xl font-bold mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {currentEscrowHold.amount?.toFixed ? currentEscrowHold.amount.toFixed(2) : currentEscrowHold.amount} {currentEscrowHold.currency}
                    </p>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Held for {platforms.find(p => p.value === currentEscrowHold.platform)?.label || currentEscrowHold.platform || 'this trade'}
                    </p>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const meta = holdStatusMeta[currentEscrowHold.status] || holdStatusMeta.held;
                      return (
                        <>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${meta.badge}`}>
                            {meta.label}
                          </span>
                          <p className={`text-xs mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {currentEscrowHold.status === 'released' && currentEscrowHold.releasedAt
                              ? `Released ${new Date(currentEscrowHold.releasedAt).toLocaleString()}`
                              : meta.description}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Details */}
            <div className="space-y-4 mb-6">
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <label className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Platform</label>
                <p className={`text-lg mt-1 capitalize ${darkMode ? 'text-white' : 'text-gray-900'}`}>{getPlatformLabel()}</p>
              </div>

              {/* Multiple Payment Methods */}
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <label className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Payment Method{paymentMethods.length > 1 ? 's' : ''}
                </label>
                {paymentMethods.map((pm, index) => {
                  const methodLabel = pm.method ? (findPaymentMethod(pm.method)?.label || pm.method) : pm.type;
                  const hasStructuredDetails = pm.method && pm.fields && Object.keys(pm.fields).some(key => (pm.fields?.[key] || '').toString().trim() !== '');

                  return (
                    <div key={pm.id} className={`mt-2 ${index > 0 ? 'pt-2 border-t border-gray-200 dark:border-gray-600' : ''}`}>
                      {methodLabel && (
                        <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{methodLabel}</p>
                      )}

                      {hasStructuredDetails ? (
                        <div className="mt-2 space-y-2">
                          {Object.entries(pm.fields).map(([fieldKey, fieldValue]) => (
                            fieldValue ? (
                              <div key={fieldKey} className={`rounded-lg p-3 ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
                                <p className={`text-xs uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {getPaymentFieldLabel(pm.method, fieldKey)}
                                </p>
                                <p className={`text-sm font-semibold break-words ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                  {fieldValue}
                                </p>
                              </div>
                            ) : null
                          ))}
                        </div>
                      ) : (
                        <p className={`text-lg whitespace-pre-wrap ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                          {pm.details}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {amount && (
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <label className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Amount</label>
                  <p className={`text-lg mt-1 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {amount} {currency}
                  </p>
                </div>
              )}

              {notes && (
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <label className={`text-sm font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Additional Notes</label>
                  <p className={`text-lg mt-1 whitespace-pre-wrap ${darkMode ? 'text-white' : 'text-gray-900'}`}>{notes}</p>
                </div>
              )}
            </div>

            {/* Seller Confirmation Checkbox */}
            {!isExpired && (
              <div className={`p-4 rounded-lg mb-6 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sellerConfirmed}
                    onChange={(e) => setSellerConfirmed(e.target.checked)}
                    className="mt-1 w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <strong>I confirm that I have received and verified the payment</strong> matching the details above. 
                    I understand that releasing cryptocurrency without proper verification may result in loss of funds.
                  </span>
                </label>
              </div>
            )}

            {/* Release Button */}
            {!isExpired && (
              <a
                href={sellerConfirmed ? getPlatformUrl() : '#'}
                target={sellerConfirmed ? '_blank' : '_self'}
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!sellerConfirmed) {
                    e.preventDefault();
                    alert('Please confirm that you have verified the payment before proceeding.');
                    return;
                  }
                  setStatus('completed');
                }}
                className={`w-full py-4 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
                  sellerConfirmed
                    ? (darkMode ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-200')
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400'
                }`}
              >
                <ExternalLink className="w-5 h-5" />
                Open {getPlatformLabel()} to Release Payment
              </a>
            )}

            <p className={`text-sm text-center mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Make sure to verify payment receipt before releasing cryptocurrency
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!clientToken) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-slate-50 to-indigo-100'} p-6`}>
        <div className="absolute top-6 right-6">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg ${darkMode ? 'bg-gray-800 text-yellow-300' : 'bg-white text-slate-600 shadow'}`}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
        <div className={`w-full max-w-md rounded-2xl shadow-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'} p-8`}> 
          <p className={`text-xs uppercase tracking-[0.3em] mb-4 ${darkMode ? 'text-indigo-200' : 'text-indigo-600'}`}>Escrow Workspace</p>
          <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Authenticate to Continue</h1>
          <p className={`text-sm mb-6 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Sign in with your client passphrase to load wallet balances, escrow holds, and notifications from the secure backend.
          </p>
          <form onSubmit={handleClientLogin} className="space-y-4">
            <div>
              <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Client Password</label>
              <input
                type="password"
                value={clientPassword}
                onChange={(e) => setClientPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border ${darkMode ? 'bg-gray-900 border-gray-700 text-white' : 'bg-gray-50 border-gray-200'} focus:ring-2 focus:ring-indigo-500`}
                placeholder="Enter passphrase"
              />
            </div>
            {(loginError || authError) && (
              <p className="text-sm text-red-500">{loginError || authError}</p>
            )}
            <button
              type="submit"
              disabled={loadingRole === 'client'}
              className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${loadingRole === 'client' ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
            >
              {loadingRole === 'client' && <Loader2 className="w-4 h-4 animate-spin" />}
              Access Workspace
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Create mode - Buyer creates payment link
  return (
    <div className={`min-h-screen transition-colors ${darkMode ? 'dark bg-gray-900' : 'bg-white'} p-6 relative`}>
      {/* Top gradient bar */}
      {!darkMode && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-violet-500 to-amber-500" />}
      
      <div className="max-w-2xl mx-auto pt-4">
        <div className={`rounded-2xl shadow-xl p-8 ${darkMode ? 'bg-gray-800' : 'bg-white border-2 border-slate-100'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'bg-gradient-to-r from-slate-800 via-violet-700 to-slate-800 bg-clip-text text-transparent'}`}>P2P Payment Coordinator</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                title="Transaction History"
              >
                <History className="w-5 h-5" />
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-600'}`}
                title="Toggle Dark Mode"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={handleClientLogout}
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Logout
              </button>
            </div>
          </div>
          <p className={`mb-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Create a payment link to share with your seller</p>

          {notifications.length > 0 && (
            <div className="mb-8">
              <NotificationCenter items={notifications} onDismiss={handleDismissNotification} />
            </div>
          )}

          {/* Transaction History Modal */}
          {showHistory && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className={`w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Transaction History</h2>
                  <button onClick={() => setShowHistory(false)} className={`p-1 rounded ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}>
                    <X className={`w-5 h-5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  {transactionHistory.length === 0 ? (
                    <p className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>No transaction history yet</p>
                  ) : (
                    <div className="space-y-3">
                      {transactionHistory.map(entry => {
                        const entryLink = entry.link || (entry.escrowId ? `${window.location.origin}${window.location.pathname}?escrowId=${entry.escrowId}` : '');
                        return (
                          <div key={entry.id} className={`p-3 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                  {entry.amount} {entry.currency}
                                </p>
                                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {platforms.find(p => p.value === entry.platform)?.label || entry.platform}
                                </p>
                                <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {new Date(entry.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => copyToClipboard(entryLink)}
                                  className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                                  title="Copy Link"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteHistoryEntry(entry.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                  title="Hide from list"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}


          {!generatedLink ? (
            <div className="space-y-6">
              {/* Platform Selection */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Trading Platform *
                </label>
                {initialPlatform && platform ? (
                  <div className={`flex items-center justify-between px-4 py-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
                    <div className="flex items-center gap-3">
                      <img
                        src={platforms.find(p => p.value === platform)?.logo}
                        alt={platforms.find(p => p.value === platform)?.label}
                        className="w-8 h-8 rounded object-contain"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                      <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {platforms.find(p => p.value === platform)?.label}
                      </span>
                    </div>
                    {onChangePlatform && (
                      <button
                        type="button"
                        onClick={onChangePlatform}
                        className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      onBlur={() => handleBlur('platform')}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                        errors.platform && touched.platform ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      } ${darkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}
                      required
                    >
                      <option value="">Select platform...</option>
                      {platforms.map(p => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                    {errors.platform && touched.platform && (
                      <p className="text-red-500 text-sm mt-1">{errors.platform}</p>
                    )}
                  </>
                )}
              </div>

              {/* Multiple Payment Methods */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Payment Methods *
                  </label>
                  <button
                    type="button"
                    onClick={addPaymentMethod}
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    <Plus className="w-4 h-4" /> Add Method
                  </button>
                </div>
                {errors.paymentMethods && (
                  <p className="text-red-500 text-sm mb-2">{errors.paymentMethods}</p>
                )}
                <div className="space-y-4">
                  {paymentMethods.map((pm, index) => {
                    const config = pm.method ? findPaymentMethod(pm.method) : null;
                    return (
                      <div key={pm.id} className={`p-4 rounded-lg border ${darkMode ? 'border-gray-600 bg-gray-700/50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            Payment Method {index + 1}
                          </span>
                          {paymentMethods.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePaymentMethod(pm.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <select
                          value={pm.method || ''}
                          onChange={(e) => handleMethodChange(pm.id, e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-3 ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                          } ${errors[`paymentMethod_${index}_method`] ? 'border-red-500' : ''}`}
                        >
                          <option value="">Select payment method...</option>
                          {paymentMethodOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        {errors[`paymentMethod_${index}_method`] && (
                          <p className="text-red-500 text-sm mt-1">{errors[`paymentMethod_${index}_method`]}</p>
                        )}

                        {pm.method && config && (
                          <div className="space-y-3">
                            {config.fields.map(field => (
                              <div key={field.name}>
                                <label className={`block text-sm font-semibold mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {field.label}{field.optional ? ' (optional)' : ' *'}
                                </label>
                                {field.inputType === 'textarea' ? (
                                  <textarea
                                    value={pm.fields?.[field.name] || ''}
                                    onChange={(e) => handleMethodFieldChange(pm.id, field.name, e.target.value)}
                                    placeholder={field.placeholder}
                                    rows="3"
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                                      errors[`paymentMethod_${index}_${field.name}`] ? 'border-red-500' : ''
                                    } ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                  />
                                ) : field.inputType === 'select' && field.name === 'provider' && config.providers ? (
                                  <select
                                    value={pm.fields?.[field.name] || ''}
                                    onChange={(e) => handleMethodFieldChange(pm.id, field.name, e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                                      errors[`paymentMethod_${index}_${field.name}`] ? 'border-red-500' : ''
                                    } ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                  >
                                    <option value="">Select provider...</option>
                                    {config.providers.map(provider => (
                                      <option key={provider} value={provider}>{provider}</option>
                                    ))}
                                  </select>
                                ) : field.inputType === 'select' && field.name === 'network' && config.networks ? (
                                  <select
                                    value={pm.fields?.[field.name] || ''}
                                    onChange={(e) => handleMethodFieldChange(pm.id, field.name, e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                                      errors[`paymentMethod_${index}_${field.name}`] ? 'border-red-500' : ''
                                    } ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                  >
                                    <option value="">Select network...</option>
                                    {config.networks.map(network => (
                                      <option key={network} value={network}>{network}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={pm.fields?.[field.name] || ''}
                                    onChange={(e) => handleMethodFieldChange(pm.id, field.name, e.target.value)}
                                    placeholder={field.placeholder}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                                      errors[`paymentMethod_${index}_${field.name}`] ? 'border-red-500' : ''
                                    } ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                                  />
                                )}
                                {errors[`paymentMethod_${index}_${field.name}`] && (
                                  <p className="text-red-500 text-sm mt-1">{errors[`paymentMethod_${index}_${field.name}`]}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {!pm.method && (
                          <p className="text-xs text-gray-500">Select a payment method to enter its required details.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Amount and Currency */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Amount
                  </label>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => handleBlur('amount')}
                    placeholder="100.00"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      errors.amount && touched.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    } ${darkMode ? 'bg-gray-700 text-white' : 'bg-white'}`}
                  />
                  {errors.amount && touched.amount && (
                    <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
                  )}
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Currency
                  </label>
                  {(() => {
                    // Gather currencies from all selected payment methods
                    const selectedMethods = paymentMethods.filter(pm => pm.method).map(pm => findPaymentMethod(pm.method));
                    const allCurrencies = selectedMethods.length > 0
                      ? [...new Set(selectedMethods.flatMap(m => m?.currencies || []))].sort()
                      : ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR', 'INR', 'USDT', 'BTC'];
                    return (
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent border-gray-300 dark:border-gray-600 ${
                          darkMode ? 'bg-gray-700 text-white' : 'bg-white'
                        }`}
                      >
                        <option value="">Select currency...</option>
                        {allCurrencies.map(curr => (
                          <option key={curr} value={curr}>{curr}</option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              </div>

              {/* Link Expiration */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Link Expiration
                </label>
                <select
                  value={expirationMinutes}
                  onChange={(e) => setExpirationMinutes(parseInt(e.target.value))}
                  className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    darkMode ? 'bg-gray-700 text-white' : 'bg-white'
                  }`}
                >
                  {expirationOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Additional Notes */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Additional Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reference number, transaction ID, or special instructions..."
                  className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    darkMode ? 'bg-gray-700 text-white' : 'bg-white'
                  }`}
                  rows="3"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={generateLink}
                className={`w-full py-4 rounded-xl font-semibold transition disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-600 ${
                  darkMode 
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-200'
                }`}
              >
                Generate Payment Link
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 rounded">
                <p className="text-green-800 dark:text-green-200 font-semibold">Link Generated Successfully!</p>
                <p className="text-green-700 dark:text-green-300 text-sm mt-1">Share this link with your seller</p>
              </div>

              {/* QR Code Toggle */}
              <div className="flex justify-center">
                <button
                  onClick={() => setShowQR(!showQR)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {showQR ? 'Hide QR Code' : 'Show QR Code'}
                </button>
              </div>

              {/* QR Code */}
              {showQR && (
                <div className="flex justify-center p-4">
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-white' : 'bg-gray-50'}`}>
                    <QRCodeSVG value={generatedLink} size={200} />
                  </div>
                </div>
              )}

              {/* Payment Link */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Payment Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className={`flex-1 px-4 py-3 border-2 rounded-xl ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                  <button
                    onClick={() => copyToClipboard()}
                    className={`px-6 py-3 rounded-xl transition flex items-center gap-2 font-semibold ${
                      darkMode 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                        : 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-lg shadow-violet-200'
                    }`}
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Sharing Buttons */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Share via
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={shareViaWhatsApp}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                  >
                    <MessageCircle className="w-5 h-5" /> WhatsApp
                  </button>
                  <button
                    onClick={shareViaTelegram}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                  >
                    <Share2 className="w-5 h-5" /> Telegram
                  </button>
                  <button
                    onClick={shareViaEmail}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    <Mail className="w-5 h-5" /> Email
                  </button>
                  <button
                    onClick={shareViaSMS}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
                  >
                    <Phone className="w-5 h-5" /> SMS
                  </button>
                </div>
              </div>

              {/* Next Steps */}
              <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}>
                <h3 className={`font-semibold mb-2 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Next Steps:</h3>
                <ol className={`text-sm space-y-1 list-decimal list-inside ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <li>Copy and share the link with your seller</li>
                  <li>Seller will review the payment details</li>
                  <li>Seller must confirm payment verification</li>
                  <li>Seller will login to their platform to release crypto</li>
                  <li>Transaction complete!</li>
                </ol>
              </div>

              {/* Create Another */}
              <button
                onClick={resetForm}
                className={`w-full py-3 rounded-lg font-semibold transition ${
                  darkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                Create Another Link
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`mt-6 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <p>Supported platforms: {platforms.map(p => p.label).join(' • ')}</p>
        </div>
      </div>
    </div>
  );
}
