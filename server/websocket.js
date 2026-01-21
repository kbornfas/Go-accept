// WebSocket - Real-time notifications

import { WebSocketServer } from 'ws';

let wss = null;
const clients = new Map();

/**
 * Initialize WebSocket server
 */
export const initWebSocket = (httpServer) => {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    clients.set(clientId, { ws, subscribedTo: [] });
    
    console.log(`🔌 [WS] Client connected: ${clientId}`);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'subscribe') {
          const client = clients.get(clientId);
          if (client && data.channel) {
            client.subscribedTo.push(data.channel);
            ws.send(JSON.stringify({ type: 'subscribed', channel: data.channel }));
          }
        }
      } catch (error) {
        console.error('WS message parse error:', error.message);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      console.log(`🔌 [WS] Client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      console.error(`WS error for ${clientId}:`, error.message);
      clients.delete(clientId);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', clientId }));
  });

  console.log('✅ WebSocket server initialized');
  return wss;
};

/**
 * Broadcast message to all connected clients
 */
const broadcast = (channel, data) => {
  if (!wss) return;

  const message = JSON.stringify({ channel, ...data });
  
  for (const [clientId, client] of clients) {
    if (client.ws.readyState === 1) { // OPEN
      if (client.subscribedTo.length === 0 || client.subscribedTo.includes(channel)) {
        client.ws.send(message);
      }
    }
  }
};

/**
 * Notify clients of escrow updates
 */
export const notifyEscrowUpdate = (escrow) => {
  broadcast('escrow', {
    type: 'escrow_update',
    escrow: {
      id: escrow.id,
      status: escrow.status,
      amount: escrow.amount,
      currency: escrow.currency
    }
  });
};

/**
 * Notify clients of wallet updates
 */
export const notifyWalletUpdate = (wallet) => {
  broadcast('wallet', {
    type: 'wallet_update',
    balances: wallet.balances
  });
};

/**
 * Get connected clients count
 */
export const getConnectedClientsCount = () => {
  return clients.size;
};
