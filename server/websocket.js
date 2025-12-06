import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;
const connectedClients = new Map();

/**
 * Initialize WebSocket server
 */
export function initWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true
    }
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.role;
    console.log(`WebSocket connected: ${userId} (${socket.id})`);

    // Store connection
    connectedClients.set(socket.id, {
      userId,
      role: socket.user.role,
      connectedAt: new Date().toISOString()
    });

    // Join role-specific room
    socket.join(socket.user.role);

    // Send connection confirmation
    socket.emit('connected', {
      message: 'WebSocket connected',
      userId,
      role: socket.user.role
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`WebSocket disconnected: ${userId} (${socket.id})`);
      connectedClients.delete(socket.id);
    });

    // Ping/pong for keep-alive
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  console.log('✅ WebSocket server initialized');
  return io;
}

/**
 * Broadcast to all clients
 */
export function broadcast(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Send to specific role (admin/client)
 */
export function sendToRole(role, event, data) {
  if (io) {
    io.to(role).emit(event, data);
  }
}

/**
 * Send escrow update notification
 */
export function notifyEscrowUpdate(escrow) {
  broadcast('escrow:updated', {
    id: escrow.id,
    status: escrow.status,
    amount: escrow.amount,
    currency: escrow.currency,
    platform: escrow.platform,
    timestamp: new Date().toISOString()
  });
}

/**
 * Send wallet update notification
 */
export function notifyWalletUpdate(wallet) {
  sendToRole('admin', 'wallet:updated', {
    balances: wallet.balances,
    timestamp: new Date().toISOString()
  });
  
  sendToRole('client', 'wallet:updated', {
    balances: wallet.balances,
    timestamp: new Date().toISOString()
  });
}

/**
 * Send notification to specific role
 */
export function sendNotification(role, notification) {
  sendToRole(role, 'notification', {
    ...notification,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get connected clients count
 */
export function getConnectedClientsCount() {
  return connectedClients.size;
}

/**
 * Get connected clients info
 */
export function getConnectedClients() {
  return Array.from(connectedClients.values());
}

export default {
  initWebSocket,
  broadcast,
  sendToRole,
  notifyEscrowUpdate,
  notifyWalletUpdate,
  sendNotification,
  getConnectedClientsCount,
  getConnectedClients
};
