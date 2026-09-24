import { Server as SocketIOServer, Socket } from 'socket.io';
import { isOriginAllowed } from '../config/cors';
import { FastifyInstance } from 'fastify';
import { logger } from '../utils/logger';

// ─── WebSocket Gateway ───────────────────────────────────────────────────────
//
// Real-time seat availability updates using Socket.io.
//
// How it works:
//   1. Frontend connects to WebSocket on /ws namespace
//   2. Frontend joins a room for a specific event: room = `event:{eventId}`
//   3. When a booking is created or cancelled, the backend broadcasts
//      updated seat statuses to all clients in that event room
//   4. Frontend receives real-time updates and refreshes the seat map
//
// This is a UX improvement — the database remains the source of truth.
// WebSocket updates never override PostgreSQL state.

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Initialize Socket.io on the Fastify HTTP server.
 */
export function initWebSocket(fastify: FastifyInstance): SocketIOServer {
  io = new SocketIOServer(fastify.server, {
    cors: {
      // Same policy as HTTP CORS — previously `*`, which leaked seat/update
      // events to any origin in production.
      origin: isOriginAllowed,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/ws',
  });

  io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id }, '🔌 WebSocket client connected');

    // Client joins a room for a specific event
    socket.on('join:event', (eventId: string) => {
      const room = `event:${eventId}`;
      socket.join(room);
      logger.info({ socketId: socket.id, eventId }, '🔌 Client joined event room');
    });

    // Client leaves an event room
    socket.on('leave:event', (eventId: string) => {
      const room = `event:${eventId}`;
      socket.leave(room);
      logger.debug({ socketId: socket.id, eventId }, '🔌 Client left event room');
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, '🔌 WebSocket client disconnected');
    });
  });

  logger.info('🔌 WebSocket gateway initialized on /ws');
  return io;
}

// ─── Broadcasting Functions ──────────────────────────────────────────────────
//
// Call these after booking/cancel to push updates to all connected clients.

export interface SeatUpdate {
  seatId: string;
  seatNumber: string;
  status: string;
  eventId: string;
  bookedBy?: string | null;
}

/**
 * Broadcast seat status changes to all clients viewing the same event.
 */
export function broadcastSeatUpdate(update: SeatUpdate): void {
  if (!io) return;

  const room = `event:${update.eventId}`;
  io.to(room).emit('seat:update', {
    type: 'seat:update',
    data: {
      seatId: update.seatId,
      seatNumber: update.seatNumber,
      status: update.status,
      eventId: update.eventId,
      timestamp: new Date().toISOString(),
    },
  });

  logger.debug({ eventId: update.eventId, seatId: update.seatId, status: update.status }, '📡 Seat update broadcast');
}

/**
 * Broadcast a bulk seat update (e.g., after a multi-seat booking).
 */
export function broadcastBulkSeatUpdate(eventId: string, updates: SeatUpdate[]): void {
  if (!io) return;

  const room = `event:${eventId}`;
  io.to(room).emit('seats:bulk-update', {
    type: 'seats:bulk-update',
    data: {
      eventId,
      updates: updates.map((u) => ({
        seatId: u.seatId,
        seatNumber: u.seatNumber,
        status: u.status,
      })),
      timestamp: new Date().toISOString(),
    },
  });

  logger.debug({ eventId, count: updates.length }, '📡 Bulk seat update broadcast');
}

/**
 * Broadcast availability summary change to all clients viewing the event.
 */
export function broadcastAvailabilityUpdate(eventId: string, availability: {
  available: number;
  booked: number;
  total: number;
}): void {
  if (!io) return;

  const room = `event:${eventId}`;
  io.to(room).emit('availability:update', {
    type: 'availability:update',
    data: {
      eventId,
      ...availability,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a notification to a specific user across all their connected tabs.
 */
export function notifyUser(userId: string, event: string, data: any): void {
  if (!io) return;

  io.to(`user:${userId}`).emit(event, data);
}
