'use client';

import { useEffect, useCallback } from 'react';
import {
  joinEventRoom,
  leaveEventRoom,
  onSeatUpdate,
  onBulkSeatUpdate,
  onAvailabilityUpdate,
} from '@/lib/websocket';

/**
 * React hook for subscribing to real-time seat updates.
 *
 * Automatically joins the event room on mount and leaves on unmount.
 * Returns update handlers that the seat map can use to reactively update.
 *
 * Usage:
 *   const { onSeatChanged, availability } = useSeatUpdates(eventId);
 *   // onSeatChanged(seatId, 'BOOKED') → updates local seat state
 */
export function useSeatUpdates(eventId: string) {
  // Subscribe to real-time updates
  useEffect(() => {
    if (!eventId) return;

    joinEventRoom(eventId);

    return () => {
      leaveEventRoom(eventId);
    };
  }, [eventId]);

  return {
    onSeatUpdate,
    onBulkSeatUpdate,
    onAvailabilityUpdate,
  };
}
