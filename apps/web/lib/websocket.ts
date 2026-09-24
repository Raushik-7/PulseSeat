import { io, Socket } from 'socket.io-client';

// ─── WebSocket Client ────────────────────────────────────────────────────────
//
// Connects to the Fastify Socket.io server for real-time seat updates.
//
// How it works:
//   1. Connects to ws://localhost:3001/ws
//   2. Joins a room for a specific event
//   3. Listens for seat:update and availability:update events
//   4. Updates the seat map in real-time
//
// The database remains the source of truth — WebSocket is purely for UX.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

/**
 * Get or create a Socket.io connection.
 */
export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  socket = io(API_URL, {
    path: '/ws',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[WebSocket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason: string) => {
    console.log('[WebSocket] Disconnected:', reason);
  });

  socket.on('connect_error', (err: Error) => {
    console.warn('[WebSocket] Connection error:', err.message);
  });

  return socket;
}

/**
 * Join an event room to receive real-time seat updates.
 */
export function joinEventRoom(eventId: string): void {
  const s = getSocket();
  s.emit('join:event', eventId);
}

/**
 * Leave an event room.
 */
export function leaveEventRoom(eventId: string): void {
  const s = getSocket();
  s.emit('leave:event', eventId);
}

/**
 * Subscribe to seat update events.
 * Returns an unsubscribe function.
 */
export function onSeatUpdate(
  callback: (data: {
    seatId: string;
    seatNumber: string;
    status: string;
    eventId: string;
  }) => void,
): () => void {
  const s = getSocket();
  s.on('seat:update', (event: { data: any }) => {
    callback(event.data);
  });
  return () => s.off('seat:update');
}

/**
 * Subscribe to bulk seat update events.
 * Returns an unsubscribe function.
 */
export function onBulkSeatUpdate(
  callback: (data: {
    eventId: string;
    updates: Array<{ seatId: string; seatNumber: string; status: string }>;
  }) => void,
): () => void {
  const s = getSocket();
  s.on('seats:bulk-update', (event: { data: any }) => {
    callback(event.data);
  });
  return () => s.off('seats:bulk-update');
}

/**
 * Subscribe to availability update events.
 * Returns an unsubscribe function.
 */
export function onAvailabilityUpdate(
  callback: (data: {
    eventId: string;
    available: number;
    booked: number;
    total: number;
  }) => void,
): () => void {
  const s = getSocket();
  s.on('availability:update', (event: { data: any }) => {
    callback(event.data);
  });
  return () => s.off('availability:update');
}

/**
 * Disconnect the socket (on logout or app close).
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
