'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Determine the server URL for Socket.IO.
 * Priority: NEXT_PUBLIC_SERVER_URL env var > auto-detect from current hostname + port 3001.
 * Auto-detect means socket.io connects directly to the backend (same host, port 3001),
 * avoiding the need for Next.js to proxy WebSocket connections.
 */
function getServerUrl(): string {
  if (process.env.NEXT_PUBLIC_SERVER_URL) {
    return process.env.NEXT_PUBLIC_SERVER_URL;
  }
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    return `http://${hostname}:3001`;
  }
  return 'http://localhost:3001';
}

export function getSocket(): Socket {
  if (!socket) {
    const serverUrl = getServerUrl();
    console.log('Socket.IO connecting to:', serverUrl);
    socket = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
