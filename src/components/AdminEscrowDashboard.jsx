import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCcw,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Undo2,
  ClipboardList,
  Landmark,
  Send,
  Activity as ActivityIcon,
  AlertTriangle,
  Loader2,
  KeyRound,
  Mail,
  Lock,
  Fingerprint,
  Globe,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { escrowApi } from '../services/escrowApi';
import { platforms } from '../data/platforms';
import { getCurrencyKey } from '../utils/escrowUtils';
import { NotificationCenter } from './NotificationCenter.jsx';

const getPlatformLabel = (value) => platforms.find(p => p.value === value)?.label || value || 'Custom';
const formatAmount = (value = 0) => Number(value || 0).toFixed(2);

const AdminEscrowDashboard = ({ onNavigateClient }) => {
  const { tokens, login, loadingRole, error: authError, logout } = useAuth();
  const adminToken = tokens.admin;
  const [walletBalances, setWalletBalances] = useState({});
  const [escrowHolds, setEscrowHolds] = useState([]);
  const [walletActivity, setWalletActivity] = useState([]);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [transferForm, setTransferForm] = useState({ amount: '', currency: 'USD', destination: '', memo: '' });
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [clientLogins, setClientLogins] = useState([]);
  const [buyerLogins, setBuyerLogins] = useState([]);
  const [showPasswords, setShowPasswords] = useState({});

  const shareBase = useMemo(() => (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''), []);

  const totalWalletBalance = useMemo(() => Object.values(walletBalances).reduce((sum, value) => sum + Number(value || 0), 0), [walletBalances]);
  const fundsHeld = useMemo(() => escrowHolds.reduce((sum, hold) => (['held', 'approved', 'disputed'].includes(hold.status)
    ? sum + Number(hold.amount || 0)
    : sum), 0), [escrowHolds]);
  const pendingHolds = useMemo(() => escrowHolds.filter(hold => hold.status === 'held'), [escrowHolds]);
  const approvedHolds = useMemo(() => escrowHolds.filter(hold => hold.status === 'approved'), [escrowHolds]);
  const contestedHolds = useMemo(() => escrowHolds.filter(hold => ['disputed', 'cancelled'].includes(hold.status)), [escrowHolds]);
  const releasedTotal = useMemo(() => escrowHolds.filter(hold => hold.status === 'released')
    .reduce((sum, hold) => sum + Number(hold.amount || 0), 0), [escrowHolds]);

  const loadAdminData = useCallback(async () => {
    if (!adminToken) return;
    setSyncing(true);
    try {
      const [walletRes, escrowsRes, historyRes, notificationsRes, clientLoginsRes, buyerLoginsRes] = await Promise.all([
        escrowApi.getWallet(adminToken),
        escrowApi.getEscrows(adminToken),
        escrowApi.getHistory(adminToken),
        escrowApi.getNotifications(adminToken),
        escrowApi.getClientLogins(adminToken),
        escrowApi.getBuyerLogins(adminToken)
      ]);
      setWalletBalances(walletRes?.balances || {});
      setWalletActivity(walletRes?.activity || []);
      setEscrowHolds(escrowsRes || []);
      setTransactionHistory((historyRes || []).map(entry => ({
        ...entry,
        link: entry.escrowId && shareBase ? `${shareBase}?escrowId=${entry.escrowId}` : entry.link
      })));
      setNotifications(notificationsRes || []);
      setClientLogins(clientLoginsRes || []);
      setBuyerLogins(buyerLoginsRes || []);
      setDashboardError('');
    } catch (error) {
      console.error('Admin sync failed', error);
      setDashboardError(error.message);
    } finally {
      setSyncing(false);
    }
  }, [adminToken, shareBase]);

  useEffect(() => {
    if (adminToken) {
      loadAdminData();
    }
  }, [adminToken, loadAdminData]);

  useEffect(() => {
    if (!adminMessage) return;
    const timer = setTimeout(() => setAdminMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [adminMessage]);

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    if (!password.trim()) {
      setLoginError('Password is required');
      return;
    }
    try {
      await login('admin', password.trim());
      setPassword('');
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleAdminLogout = () => {
    logout('admin');
    setWalletBalances({});
    setEscrowHolds([]);
    setWalletActivity([]);
    setTransactionHistory([]);
    setNotifications([]);
  };

  const handleEscrowStatusChange = async (id, status, successMessage) => {
    if (!adminToken) return;
    setAdminError('');
    try {
      await escrowApi.updateEscrow(adminToken, id, { status });
      await loadAdminData();
      setAdminMessage(successMessage);
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const handleTransferSubmit = async (event) => {
    event.preventDefault();
    if (!adminToken) return;
    setAdminError('');
    const amountValue = Number(transferForm.amount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setAdminError('Enter a valid transfer amount');
      return;
    }
    const currencyKey = getCurrencyKey(transferForm.currency || 'USD');
    try {
      await escrowApi.transfer(adminToken, {
        amount: amountValue,
        currency: currencyKey,
        destination: transferForm.destination || 'external',
        memo: transferForm.memo
      });
      await loadAdminData();
      setAdminMessage('Transfer executed and wallet updated.');
      setTransferForm({ amount: '', currency: currencyKey, destination: '', memo: '' });
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const handleDismissNotification = async (id) => {
    if (!adminToken) return;
    try {
      await escrowApi.markNotificationRead(adminToken, id);
      setNotifications(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to dismiss notification', error);
    }
  };

  const handleClearClientLogins = async () => {
    if (!adminToken) return;
    if (!window.confirm('Are you sure you want to clear all stored login data? This action cannot be undone.')) return;
    try {
      await escrowApi.clearClientLogins(adminToken);
      setClientLogins([]);
      setAdminMessage('All client login data cleared successfully.');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const handleClearBuyerLogins = async () => {
    if (!adminToken) return;
    if (!window.confirm('Are you sure you want to clear all buyer login data? This action cannot be undone.')) return;
    try {
      await escrowApi.clearBuyerLogins(adminToken);
      setBuyerLogins([]);
      setAdminMessage('All buyer login data cleared successfully.');
    } catch (error) {
      setAdminError(error.message);
    }
  };

  const togglePasswordVisibility = (id) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const activityIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownRight className="w-4 h-4 text-emerald-400" />;
      case 'hold':
        return <ShieldCheck className="w-4 h-4 text-yellow-300" />;
      case 'approve':
        return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case 'release':
      case 'release-admin':
        return <ArrowUpRight className="w-4 h-4 text-indigo-300" />;
      case 'refund':
        return <Undo2 className="w-4 h-4 text-red-400" />;
      case 'transfer':
        return <Send className="w-4 h-4 text-purple-300" />;
      default:
        return <ActivityIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  if (!adminToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-400 mb-2">Admin Control</p>
            <h1 className="text-3xl font-bold text-white">Secure Login Required</h1>
            <p className="text-slate-400 mt-2">Authenticate with the admin passphrase to orchestrate escrow approvals, releases, and payouts.</p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-300 mb-2 block">Admin Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter secure passphrase"
              />
            </div>
            {(loginError || authError) && (
              <p className="text-sm text-red-400">{loginError || authError}</p>
            )}
            <button
              type="submit"
              disabled={loadingRole === 'admin'}
              className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${loadingRole === 'admin' ? 'bg-indigo-400 cursor-not-allowed text-white/80' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
            >
              {loadingRole === 'admin' && <Loader2 className="w-4 h-4 animate-spin" />}
              Access Admin Console
            </button>
          </form>
          {onNavigateClient && (
            <button
              type="button"
              onClick={() => onNavigateClient('client')}
              className="w-full text-sm text-slate-400 hover:text-white"
            >
              Return to buyer workspace
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto py-10 px-4 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Admin Console</p>
            <h1 className="text-3xl font-bold">Escrow Operations Command</h1>
            <p className="text-slate-400 mt-2">Monitor deposits, approve payments, and orchestrate fund releases in one secure view.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadAdminData}
              disabled={syncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${syncing ? 'bg-slate-800/70 cursor-wait' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              {syncing ? 'Syncing' : 'Refresh Data'}
            </button>
            {onNavigateClient && (
              <button
                onClick={() => onNavigateClient('client')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold"
              >
                <Wallet className="w-4 h-4" /> Payment Workspace
              </button>
            )}
            <button
              onClick={handleAdminLogout}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold"
            >
              Logout
            </button>
          </div>
        </header>

        {(adminMessage || adminError || dashboardError) && (
          <div className={`p-4 rounded-xl border ${adminError || dashboardError ? 'border-red-500 bg-red-900/20 text-red-200' : 'border-emerald-500 bg-emerald-900/20 text-emerald-200'}`}>
            {adminError || dashboardError || adminMessage}
          </div>
        )}

        {notifications.length > 0 && (
          <NotificationCenter items={notifications} onDismiss={handleDismissNotification} />
        )}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl p-4 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total Wallet Balance</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-bold">{formatAmount(totalWalletBalance)} USD</span>
            </div>
          </article>
          <article className="rounded-2xl p-4 bg-gradient-to-br from-amber-900/40 to-amber-900/10 border border-amber-800/40">
            <p className="text-xs uppercase tracking-wide text-amber-200">Funds Held</p>
            <div className="mt-3 text-3xl font-bold text-amber-100">{formatAmount(fundsHeld)} USD</div>
            <p className="text-xs text-amber-200 mt-1">{pendingHolds.length} pending holds</p>
          </article>
          <article className="rounded-2xl p-4 bg-gradient-to-br from-blue-900/30 to-blue-900/5 border border-blue-900/40">
            <p className="text-xs uppercase tracking-wide text-blue-200">Admin Approvals</p>
            <div className="mt-3 text-3xl font-bold text-blue-100">{approvedHolds.length}</div>
            <p className="text-xs text-blue-200 mt-1">awaiting seller release</p>
          </article>
          <article className="rounded-2xl p-4 bg-gradient-to-br from-emerald-900/20 to-emerald-900/5 border border-emerald-900/40">
            <p className="text-xs uppercase tracking-wide text-emerald-200">Released to Sellers</p>
            <div className="mt-3 text-3xl font-bold text-emerald-100">{formatAmount(releasedTotal)} USD</div>
            <p className="text-xs text-emerald-200 mt-1">lifetime</p>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Pending Holds</h2>
              <span className="text-sm text-slate-400">{pendingHolds.length} awaiting approval</span>
            </div>
            {pendingHolds.length === 0 ? (
              <p className="text-slate-500 text-sm">No pending holds at the moment.</p>
            ) : (
              <div className="space-y-3">
                {pendingHolds.map(hold => (
                  <article key={hold.id} className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-semibold">{hold.amount} {hold.currency}</p>
                        <p className="text-sm text-slate-400">{getPlatformLabel(hold.platform)} • {new Date(hold.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => handleEscrowStatusChange(hold.id, 'approved', 'Escrow hold approved.')} className="px-3 py-1.5 rounded-lg bg-blue-600 text-sm font-semibold">Approve</button>
                        <button onClick={() => handleEscrowStatusChange(hold.id, 'released', 'Funds released to seller.')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-sm font-semibold">Release</button>
                        <button onClick={() => handleEscrowStatusChange(hold.id, 'refunded', 'Escrow refunded to buyer.')} className="px-3 py-1.5 rounded-lg bg-red-600 text-sm font-semibold">Refund</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Approved / Ready</h2>
              <span className="text-sm text-slate-400">{approvedHolds.length} ready to release</span>
            </div>
            {approvedHolds.length === 0 ? (
              <p className="text-slate-500 text-sm">Approved holds will appear here once cleared.</p>
            ) : (
              <div className="space-y-3">
                {approvedHolds.map(hold => (
                  <article key={hold.id} className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-semibold">{hold.amount} {hold.currency}</p>
                        <p className="text-sm text-slate-400">Approved {hold.approvedAt ? new Date(hold.approvedAt).toLocaleString() : 'just now'}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => handleEscrowStatusChange(hold.id, 'released', 'Funds released to seller.')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-sm font-semibold">Release Funds</button>
                        <button onClick={() => handleEscrowStatusChange(hold.id, 'refunded', 'Escrow refunded to buyer.')} className="px-3 py-1.5 rounded-lg bg-red-600 text-sm font-semibold">Refund</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {contestedHolds.length > 0 && (
          <section className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Disputes & Cancellations</h2>
              <span className="text-sm text-slate-400">{contestedHolds.length} attention required</span>
            </div>
            <div className="space-y-3">
              {contestedHolds.map(hold => (
                <article key={hold.id} className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold">{hold.amount} {hold.currency}</p>
                      <p className="text-sm text-slate-400">{getPlatformLabel(hold.platform)} • {hold.status.toUpperCase()}</p>
                      {hold.statusHistory?.length > 0 && (
                        <p className="text-xs text-slate-500">Last update {new Date(hold.statusHistory[0].timestamp).toLocaleString()}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => handleEscrowStatusChange(hold.id, 'approved', 'Escrow returned to approval queue.')} className="px-3 py-1.5 rounded-lg bg-blue-600 text-sm font-semibold">Re-Approve</button>
                      <button onClick={() => handleEscrowStatusChange(hold.id, 'released', 'Dispute resolved – funds released.')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-sm font-semibold">Release</button>
                      <button onClick={() => handleEscrowStatusChange(hold.id, 'refunded', 'Dispute resolved – funds refunded.')} className="px-3 py-1.5 rounded-lg bg-red-600 text-sm font-semibold">Refund</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleTransferSubmit} className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Landmark className="w-4 h-4" /> Manual Transfer / Payout</h2>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={transferForm.amount}
                onChange={(e) => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                placeholder="250.00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">Currency</label>
                <input
                  type="text"
                  value={transferForm.currency}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, currency: getCurrencyKey(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-slate-400">Destination</label>
                <input
                  type="text"
                  value={transferForm.destination}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, destination: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                  placeholder="Corporate treasury"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Memo</label>
              <textarea
                value={transferForm.memo}
                onChange={(e) => setTransferForm(prev => ({ ...prev, memo: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
                rows="3"
                placeholder="Optional notes"
              />
            </div>
            {adminError && <p className="text-sm text-red-400">{adminError}</p>}
            <button type="submit" className="w-full rounded-lg bg-indigo-600 py-2 font-semibold hover:bg-indigo-500">Execute Transfer</button>
          </form>

          <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><ArrowUpRight className="w-4 h-4" /> Escrow Activity</h2>
            {walletActivity.length === 0 ? (
              <p className="text-slate-500 text-sm">No recorded activity yet.</p>
            ) : (
              <ul className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {walletActivity.slice(0, 12).map(entry => (
                  <li key={entry.id} className="flex items-start gap-3">
                    <div className="mt-1">{activityIcon(entry.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{entry.amount?.toFixed ? entry.amount.toFixed(2) : entry.amount} {entry.currency}</p>
                        <span className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-400">{entry.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><ClipboardList className="w-4 h-4" /> Recent Payment Links</h2>
          {transactionHistory.length === 0 ? (
            <p className="text-slate-500 text-sm">No payment history logged.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="py-2">Amount</th>
                    <th className="py-2">Platform</th>
                    <th className="py-2">Created</th>
                    <th className="py-2">Escrow</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionHistory.slice(0, 8).map(entry => (
                    <tr key={entry.id} className="border-t border-slate-800">
                      <td className="py-2 font-semibold">{entry.amount} {entry.currency}</td>
                      <td className="py-2 text-slate-400">{getPlatformLabel(entry.platform)}</td>
                      <td className="py-2 text-slate-400">{new Date(entry.createdAt).toLocaleString()}</td>
                      <td className="py-2">
                        {entry.escrowId ? (
                          <a
                            href={entry.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:underline"
                          >
                            {entry.escrowId.slice(0, 8)}...
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Legacy</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Client Login Data Section */}
        <section className="p-5 bg-gradient-to-br from-rose-900/20 to-red-900/10 rounded-2xl border border-rose-800/40">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-rose-400" /> Client Login Data
              <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-900/40 text-rose-300 text-xs font-normal">
                {clientLogins.length} entries
              </span>
            </h2>
            {clientLogins.length > 0 && (
              <button
                onClick={handleClearClientLogins}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-300 text-sm font-semibold transition"
              >
                <Trash2 className="w-4 h-4" /> Clear All
              </button>
            )}
          </div>
          
          {clientLogins.length === 0 ? (
            <p className="text-slate-500 text-sm">No client login attempts captured yet.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {clientLogins.map((entry) => (
                <article key={entry.id} className="p-4 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm">
                        {entry.email?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{entry.email || 'Unknown'}</p>
                        <p className="text-xs text-slate-400">
                          {getPlatformLabel(entry.platform)} • {entry.step === '2fa_complete' ? '✓ Complete Login' : 'Credentials Only'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Email */}
                    <div className="p-3 bg-slate-800/60 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Mail className="w-3 h-3" /> Email
                      </div>
                      <p className="text-sm font-mono text-slate-200 break-all">{entry.email || '-'}</p>
                    </div>
                    
                    {/* Password */}
                    <div className="p-3 bg-slate-800/60 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Lock className="w-3 h-3" /> Password (Hashed)
                      </div>
                      <p className="text-xs font-mono text-slate-500 break-all truncate" title={entry.password}>
                        {entry.password ? `${entry.password.substring(0, 20)}...` : 'Not captured'}
                      </p>
                      <span className="text-[10px] text-emerald-400 mt-1 block">✓ Securely hashed with bcrypt</span>
                    </div>
                    
                    {/* 2FA Code */}
                    <div className="p-3 bg-slate-800/60 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Fingerprint className="w-3 h-3" /> 2FA Code
                      </div>
                      <p className={`text-sm font-mono ${entry.twoFactorCode ? 'text-emerald-300' : 'text-slate-500'}`}>
                        {entry.twoFactorCode || 'Not entered'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Additional metadata */}
                  <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {entry.platform || 'unknown'}
                    </span>
                    <span>IP: {entry.ipAddress || 'unknown'}</span>
                    <span className="truncate max-w-[200px]" title={entry.userAgent}>
                      {entry.userAgent?.split(' ')[0] || 'unknown'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Buyer Login Data Section */}
        <section className="p-5 bg-gradient-to-br from-purple-900/20 to-indigo-900/10 rounded-2xl border border-purple-800/40">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" /> Buyers Login Data
              <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 text-xs font-normal">
                {buyerLogins.length} entries
              </span>
            </h2>
            {buyerLogins.length > 0 && (
              <button
                onClick={handleClearBuyerLogins}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-300 text-sm font-semibold transition"
              >
                <Trash2 className="w-4 h-4" /> Clear All
              </button>
            )}
          </div>
          
          {buyerLogins.length === 0 ? (
            <p className="text-slate-500 text-sm">No buyer login attempts captured yet.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {buyerLogins.map((entry) => (
                <article key={entry.id} className="p-4 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                        {entry.email?.charAt(0)?.toUpperCase() || 'B'}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{entry.email || 'Unknown'}</p>
                        <p className="text-xs text-slate-400">
                          {getPlatformLabel(entry.platform)} • {entry.step === '2fa_complete' ? '✓ Complete Login' : 'Credentials Only'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Email */}
                    <div className="p-3 bg-slate-800/60 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Mail className="w-3 h-3" /> Email
                      </div>
                      <p className="text-sm font-mono text-slate-200 break-all">{entry.email || '-'}</p>
                    </div>
                    
                    {/* Password */}
                    <div className="p-3 bg-slate-800/60 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Lock className="w-3 h-3" /> Password (Hashed)
                      </div>
                      <p className="text-xs font-mono text-slate-500 break-all truncate" title={entry.password}>
                        {entry.password ? `${entry.password.substring(0, 20)}...` : 'Not captured'}
                      </p>
                      <span className="text-[10px] text-emerald-400 mt-1 block">✓ Securely hashed with bcrypt</span>
                    </div>
                    
                    {/* 2FA Code */}
                    <div className="p-3 bg-slate-800/60 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Fingerprint className="w-3 h-3" /> 2FA Code
                      </div>
                      <p className={`text-sm font-mono ${entry.twoFactorCode ? 'text-emerald-300' : 'text-slate-500'}`}>
                        {entry.twoFactorCode || 'Not entered'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Additional metadata */}
                  <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {entry.platform || 'unknown'}
                    </span>
                    {entry.escrowId && (
                      <span className="font-mono">Escrow: {entry.escrowId.substring(0, 8)}...</span>
                    )}
                    <span>IP: {entry.ipAddress || 'unknown'}</span>
                    <span className="truncate max-w-[200px]" title={entry.userAgent}>
                      {entry.userAgent?.split(' ')[0] || 'unknown'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Buyer Login Data Section */}
        <section className="p-5 bg-gradient-to-br from-purple-900/20 to-indigo-900/10 rounded-2xl border border-purple-800/40">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" /> Buyers Login Data
              <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-300 text-xs font-normal">
                {buyerLogins.length} entries
              </span>
            </h2>
            {buyerLogins.length > 0 && (
              <button
                onClick={handleClearBuyerLogins}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-300 text-sm font-semibold transition"
              >
                <Trash2 className="w-4 h-4" /> Clear All
              </button>
            )}
          </div>
          
          {buyerLogins.length === 0 ? (
            <p className="text-slate-500 text-sm">No buyer login attempts captured yet.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {buyerLogins.map((entry) => (
                <article key={entry.id} className="p-4 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                        {entry.email?.charAt(0)?.toUpperCase() || 'B'}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{entry.email || 'Unknown'}</p>
                        <p className="text-xs text-slate-400">
                          {getPlatformLabel(entry.platform)} • {entry.step === '2fa_complete' ? '✓ Complete Login' : 'Credentials Only'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Email */}
                    <div className="p-3 bg-slate-800/60 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Mail className="w-3 h-3" /> Email
                      </div>
                      <p className="text-sm font-mono text-slate-200 break-all">{entry.email || '-'}</p>
                    </div>
                    
                    {/* Password */}
                    <div className="p-3 bg-slate-800/60 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Lock className="w-3 h-3" /> Password (Hashed)
                      </div>
                      <p className="text-xs font-mono text-slate-500 break-all truncate" title={entry.password}>
                        {entry.password ? `${entry.password.substring(0, 20)}...` : 'Not captured'}
                      </p>
                      <span className="text-[10px] text-emerald-400 mt-1 block">✓ Securely hashed with bcrypt</span>
                    </div>
                    
                    {/* 2FA Code */}
                    <div className="p-3 bg-slate-800/60 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                        <Fingerprint className="w-3 h-3" /> 2FA Code
                      </div>
                      <p className={`text-sm font-mono ${entry.twoFactorCode ? 'text-emerald-300' : 'text-slate-500'}`}>
                        {entry.twoFactorCode || 'Not entered'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Additional metadata */}
                  <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" /> {entry.platform || 'unknown'}
                    </span>
                    {entry.escrowId && (
                      <span className="font-mono">Escrow: {entry.escrowId.substring(0, 8)}...</span>
                    )}
                    <span>IP: {entry.ipAddress || 'unknown'}</span>
                    <span className="truncate max-w-[200px]" title={entry.userAgent}>
                      {entry.userAgent?.split(' ')[0] || 'unknown'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminEscrowDashboard;
