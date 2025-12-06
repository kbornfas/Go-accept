import { useEffect, useState } from 'react';
import io from 'socket.io-client';

let socket = null;

export function useWebSocket(token) {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!token) return;

    socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 50));
    });

    socket.on('escrow:updated', (data) => {
      // Trigger escrow list refresh
      window.dispatchEvent(new CustomEvent('escrow-updated', { detail: data }));
    });

    socket.on('wallet:updated', (data) => {
      // Trigger wallet refresh
      window.dispatchEvent(new CustomEvent('wallet-updated', { detail: data }));
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [token]);

  return { connected, notifications, socket };
}

export function emitEvent(event, data) {
  if (socket?.connected) {
    socket.emit(event, data);
  }
}
