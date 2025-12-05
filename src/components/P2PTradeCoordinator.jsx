import React, { useState, useEffect } from 'react';
import { Copy, Check, Upload, MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, Eye, Send } from 'lucide-react';

export default function P2PTradeCoordinator() {
  const [trades, setTrades] = useState([]);
  const [currentView, setCurrentView] = useState('create');
  const [tradeId, setTradeId] = useState('');
  const [userRole, setUserRole] = useState('');
  
  // Trade creation form
  const [platform, setPlatform] = useState('');
  const [tradeType, setTradeType] = useState('buy');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [cryptoType, setCryptoType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentMethodDetails, setPaymentMethodDetails] = useState({});
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  // Trade view state
  const [currentTrade, setCurrentTrade] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploadedReceipt, setUploadedReceipt] = useState(null);

  const platforms = [
    { value: 'noones', label: 'Noones' },
    { value: 'bybit', label: 'Bybit P2P' },
    { value: 'localcoinswap', label: 'LocalCoinSwap' },
    { value: 'paxful', label: 'Paxful' },
    { value: 'binance', label: 'Binance P2P' }
  ];

  const paymentMethodOptions = [
    {
      value: 'bank_transfer',
      label: 'Bank Transfer',
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
      fields: [
        { name: 'provider', label: 'Provider', placeholder: 'M-Pesa, Airtel, MTN...' },
        { name: 'phoneNumber', label: 'Registered Phone Number', placeholder: '+254 700 000000' },
        { name: 'accountName', label: 'Account Name', placeholder: 'Jane Doe' }
      ]
    },
    {
      value: 'paypal',
      label: 'PayPal',
      fields: [
        { name: 'email', label: 'PayPal Email', placeholder: 'buyer@example.com' }
      ]
    },
    {
      value: 'cashapp',
      label: 'Cash App',
      fields: [
        { name: 'cashtag', label: 'Cashtag', placeholder: '$username' },
        { name: 'accountName', label: 'Account Name', placeholder: 'John Doe', optional: true }
      ]
    },
    {
      value: 'wise',
      label: 'Wise (TransferWise)',
      fields: [
        { name: 'email', label: 'Wise Email', placeholder: 'wise@example.com' },
        { name: 'fullName', label: 'Full Name', placeholder: 'John Doe' },
        { name: 'reference', label: 'Reference (if any)', placeholder: 'Invoice 123', optional: true }
      ]
    },
    {
      value: 'upi',
      label: 'UPI (India)',
      fields: [
        { name: 'upiId', label: 'UPI ID', placeholder: 'name@bank' },
        { name: 'accountName', label: 'Account Name', placeholder: 'Rahul Sharma' }
      ]
    },
    {
      value: 'crypto_wallet',
      label: 'Crypto Wallet',
      fields: [
        { name: 'network', label: 'Network / Chain', placeholder: 'ERC20, TRC20, BEP20...' },
        { name: 'address', label: 'Wallet Address', placeholder: '0xabc123...' }
      ]
    },
    {
      value: 'other',
      label: 'Other / Custom',
      fields: [
        { name: 'instructions', label: 'Payment Instructions', placeholder: 'Describe the payment method and instructions...', inputType: 'textarea' }
      ]
    }
  ];

  const tradeStatuses = {
    pending: { label: 'Pending Payment', color: 'yellow', icon: Clock },
    paid: { label: 'Payment Submitted', color: 'blue', icon: AlertCircle },
    verifying: { label: 'Verifying Payment', color: 'purple', icon: Eye },
    completed: { label: 'Completed', color: 'green', icon: CheckCircle },
    disputed: { label: 'Disputed', color: 'red', icon: XCircle }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('trade');
    const role = params.get('role');
    
    if (id && role) {
      setTradeId(id);
      setUserRole(role);
      loadTrade(id);
      setCurrentView('trade');
    }
  }, []);

  const selectedPaymentMethod = paymentMethodOptions.find(method => method.value === paymentMethod);
  const arePaymentFieldsComplete = selectedPaymentMethod
    ? selectedPaymentMethod.fields.every(field => {
        if (field.optional) return true;
        const value = paymentMethodDetails[field.name];
        return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
      })
    : false;

  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value);
    setPaymentMethodDetails({});
  };

  const handlePaymentDetailChange = (field, value) => {
    setPaymentMethodDetails(prev => ({ ...prev, [field]: value }));
  };

  const getPaymentMethodLabel = (value) => {
    const method = paymentMethodOptions.find(option => option.value === value);
    return method ? method.label : value;
  };

  const getPaymentFieldLabel = (methodValue, fieldName) => {
    const config = paymentMethodOptions.find(option => option.value === methodValue);
    if (!config) return fieldName;
    const field = config.fields.find(item => item.name === fieldName);
    return field ? field.label : fieldName;
  };

  const formatPaymentSummary = (methodValue, details) => {
    const config = paymentMethodOptions.find(option => option.value === methodValue);
    if (!config) return '';
    return config.fields
      .filter(field => details[field.name])
      .map(field => `${field.label}: ${details[field.name]}`)
      .join('\n');
  };

  const loadTrade = (id) => {
    try {
      const data = JSON.parse(atob(id));
      setCurrentTrade(data);
      setMessages(data.messages || []);
    } catch (e) {
      console.error('Invalid trade link');
    }
  };

  const createTrade = () => {
    if (!selectedPaymentMethod || !arePaymentFieldsComplete) return;

    const paymentSummary = formatPaymentSummary(paymentMethod, paymentMethodDetails);

    const trade = {
      id: Date.now().toString(),
      platform,
      tradeType,
      amount,
      currency,
      cryptoAmount,
      cryptoType,
      paymentMethod,
      paymentMethodDetails,
      paymentDetails: paymentSummary,
      paymentInstructions,
      sellerEmail,
      status: 'pending',
      createdAt: new Date().toISOString(),
      messages: [],
      receipts: []
    };

    const encoded = btoa(JSON.stringify(trade));
    const buyerLink = `${window.location.origin}${window.location.pathname}?trade=${encoded}&role=buyer`;
    const sellerLink = `${window.location.origin}${window.location.pathname}?trade=${encoded}&role=seller`;
    
    setGeneratedLink({ buyer: buyerLink, seller: sellerLink });
    setCurrentTrade(trade);
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    
    const message = {
      id: Date.now().toString(),
      sender: userRole,
      text: newMessage,
      timestamp: new Date().toISOString()
    };
    
    const updatedMessages = [...messages, message];
    setMessages(updatedMessages);
    
    const updatedTrade = { ...currentTrade, messages: updatedMessages };
    setCurrentTrade(updatedTrade);
    setNewMessage('');
  };

  const handleReceiptUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedReceipt({
          name: file.name,
          data: reader.result,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userRole
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const submitPaymentProof = () => {
    if (!uploadedReceipt) return;
    
    const updatedReceipts = [...(currentTrade.receipts || []), uploadedReceipt];
    const updatedTrade = { 
      ...currentTrade, 
      receipts: updatedReceipts,
      status: 'paid'
    };
    setCurrentTrade(updatedTrade);
    
    const message = {
      id: Date.now().toString(),
      sender: userRole,
      text: `Payment receipt uploaded: ${uploadedReceipt.name}`,
      timestamp: new Date().toISOString(),
      isSystemMessage: true
    };
    setMessages([...messages, message]);
    setUploadedReceipt(null);
  };

  const updateTradeStatus = (newStatus) => {
    const updatedTrade = { ...currentTrade, status: newStatus };
    setCurrentTrade(updatedTrade);
    
    const message = {
      id: Date.now().toString(),
      sender: 'system',
      text: `Trade status updated to: ${tradeStatuses[newStatus].label}`,
      timestamp: new Date().toISOString(),
      isSystemMessage: true
    };
    setMessages([...messages, message]);
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
  };

  if (currentView === 'trade' && currentTrade) {
    const StatusIcon = tradeStatuses[currentTrade.status].icon;
    const structuredPaymentDetails = currentTrade.paymentMethodDetails && typeof currentTrade.paymentMethodDetails === 'object' && !Array.isArray(currentTrade.paymentMethodDetails)
      ? currentTrade.paymentMethodDetails
      : null;
    
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Trade #{currentTrade.id}</h1>
                <p className="text-sm text-gray-600">Role: <span className="font-semibold capitalize">{userRole}</span></p>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-${tradeStatuses[currentTrade.status].color}-100`}>
                <StatusIcon className={`w-5 h-5 text-${tradeStatuses[currentTrade.status].color}-600`} />
                <span className={`font-semibold text-${tradeStatuses[currentTrade.status].color}-700`}>
                  {tradeStatuses[currentTrade.status].label}
                </span>
              </div>
            </div>

            {/* Trade Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Platform</p>
                <p className="font-semibold capitalize">{currentTrade.platform}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount</p>
                <p className="font-semibold">{currentTrade.amount} {currentTrade.currency}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Crypto</p>
                <p className="font-semibold">{currentTrade.cryptoAmount} {currentTrade.cryptoType}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Method</p>
                <p className="font-semibold">{currentTrade.paymentMethod}</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Payment Details & Actions */}
            <div className="md:col-span-1 space-y-4">
              {/* Payment Details */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-bold mb-4">Payment Details</h2>
                <div className="bg-gray-50 p-4 rounded text-sm space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Method</p>
                    <p className="font-semibold capitalize">{getPaymentMethodLabel(currentTrade.paymentMethod)}</p>
                  </div>

                  {structuredPaymentDetails && Object.keys(structuredPaymentDetails).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(structuredPaymentDetails).map(([fieldKey, fieldValue]) => (
                        fieldValue ? (
                          <div key={fieldKey} className="bg-white border border-gray-200 rounded-lg p-3">
                            <p className="text-xs text-gray-500">{getPaymentFieldLabel(currentTrade.paymentMethod, fieldKey)}</p>
                            <p className="font-semibold text-gray-800 break-words whitespace-pre-wrap">{fieldValue}</p>
                          </div>
                        ) : null
                      ))}
                    </div>
                  ) : currentTrade.paymentDetails ? (
                    <p className="whitespace-pre-wrap">{currentTrade.paymentDetails}</p>
                  ) : (
                    <p className="text-gray-500">No payment details provided.</p>
                  )}

                  {typeof currentTrade.paymentInstructions === 'string' && currentTrade.paymentInstructions.trim() !== '' && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Additional Instructions</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{currentTrade.paymentInstructions}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Proof Upload (Buyer Only) */}
              {userRole === 'buyer' && currentTrade.status === 'pending' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-bold mb-4">Upload Payment Proof</h2>
                  <div className="space-y-3">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Click to upload receipt</span>
                      <input type="file" className="hidden" onChange={handleReceiptUpload} accept="image/*,.pdf" />
                    </label>
                    
                    {uploadedReceipt && (
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-sm text-green-800 font-semibold">{uploadedReceipt.name}</p>
                        <button
                          onClick={submitPaymentProof}
                          className="w-full mt-2 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                        >
                          Submit Payment Proof
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Seller Actions */}
              {userRole === 'seller' && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-bold mb-4">Seller Actions</h2>
                  <div className="space-y-2">
                    {currentTrade.status === 'paid' && (
                      <>
                        <button
                          onClick={() => updateTradeStatus('verifying')}
                          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                        >
                          Verify Payment
                        </button>
                        <button
                          onClick={() => updateTradeStatus('disputed')}
                          className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700"
                        >
                          Dispute Payment
                        </button>
                      </>
                    )}
                    {currentTrade.status === 'verifying' && (
                      <button
                        onClick={() => updateTradeStatus('completed')}
                        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                      >
                        Release Crypto & Complete
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Receipts */}
              {currentTrade.receipts && currentTrade.receipts.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-bold mb-4">Payment Receipts</h2>
                  <div className="space-y-2">
                    {currentTrade.receipts.map((receipt, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded">
                        <p className="text-sm font-semibold">{receipt.name}</p>
                        <p className="text-xs text-gray-500">
                          Uploaded by {receipt.uploadedBy} • {new Date(receipt.uploadedAt).toLocaleString()}
                        </p>
                        {receipt.data && (
                          <a
                            href={receipt.data}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View Receipt
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Chat/Communication */}
            <div className="md:col-span-2 bg-white rounded-lg shadow-sm flex flex-col h-[600px]">
              <div className="p-4 border-b">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Trade Chat
                </h2>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-center text-gray-500 text-sm">No messages yet. Start the conversation!</p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.isSystemMessage ? 'justify-center' : msg.sender === userRole ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.isSystemMessage ? (
                      <div className="bg-gray-100 px-4 py-2 rounded-full text-xs text-gray-600">
                        {msg.text}
                      </div>
                    ) : (
                      <div className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.sender === userRole 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-800'
                      }`}>
                        <p className="text-sm font-semibold capitalize mb-1">{msg.sender}</p>
                        <p className="text-sm">{msg.text}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={sendMessage}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (generatedLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800">Trade Created Successfully!</h2>
              <p className="text-gray-600 mt-2">Share these links with the respective parties</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Link (Buyer)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedLink.buyer}
                    readOnly
                    className="flex-1 px-4 py-2 border rounded-lg bg-gray-50 text-sm"
                  />
                  <button
                    onClick={() => copyLink(generatedLink.buyer)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Seller Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedLink.seller}
                    readOnly
                    className="flex-1 px-4 py-2 border rounded-lg bg-gray-50 text-sm"
                  />
                  <button
                    onClick={() => copyLink(generatedLink.seller)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">Trade Process:</h3>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Buyer makes payment using provided details</li>
                <li>Buyer uploads payment receipt/proof</li>
                <li>Seller verifies payment receipt</li>
                <li>Seller releases cryptocurrency on the platform</li>
                <li>Trade marked as completed</li>
              </ol>
            </div>

            <button
              onClick={() => {
                setGeneratedLink('');
                setCurrentView('create');
              }}
              className="w-full mt-6 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700"
            >
              Create Another Trade
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">P2P Trade Coordinator</h1>
          <p className="text-gray-600 mb-8">Create secure P2P trades with built-in communication and receipt verification</p>

          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Platform *</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select platform...</option>
                  {platforms.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Trade Type *</label>
                <select
                  value={tradeType}
                  onChange={(e) => setTradeType(e.target.value)}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="buy">Buying Crypto</option>
                  <option value="sell">Selling Crypto</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Fiat Amount *</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Currency *</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  placeholder="USD, KES, EUR..."
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Crypto Amount *</label>
                <input
                  type="text"
                  value={cryptoAmount}
                  onChange={(e) => setCryptoAmount(e.target.value)}
                  placeholder="0.5"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Crypto Type *</label>
                <input
                  type="text"
                  value={cryptoType}
                  onChange={(e) => setCryptoType(e.target.value)}
                  placeholder="BTC, ETH, USDT..."
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => handlePaymentMethodChange(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select payment method...</option>
                {paymentMethodOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            {paymentMethod && selectedPaymentMethod && (
              <div className="space-y-4 p-4 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                <p className="text-sm font-semibold text-gray-700">
                  Provide the details required for {selectedPaymentMethod.label}
                </p>
                {selectedPaymentMethod.fields.map(field => (
                  <div key={field.name}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {field.label}{field.optional ? ' (optional)' : ' *'}
                    </label>
                    {field.inputType === 'textarea' ? (
                      <textarea
                        value={paymentMethodDetails[field.name] || ''}
                        onChange={(e) => handlePaymentDetailChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows="3"
                      />
                    ) : (
                      <input
                        type="text"
                        value={paymentMethodDetails[field.name] || ''}
                        onChange={(e) => handlePaymentDetailChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Instructions</label>
              <textarea
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                placeholder="Reference numbers, release instructions, or any extra notes for the counterparty..."
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
              <p className="text-xs text-gray-500 mt-1">Optional, visible to both buyer and seller</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Seller Email/Contact</label>
              <input
                type="text"
                value={sellerEmail}
                onChange={(e) => setSellerEmail(e.target.value)}
                placeholder="seller@example.com"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={createTrade}
              disabled={!platform || !amount || !currency || !cryptoAmount || !cryptoType || !paymentMethod || !selectedPaymentMethod || !arePaymentFieldsComplete}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Create Trade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
