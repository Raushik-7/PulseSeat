import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { cacheGet, cacheSet } from '../../plugins/redis-safe';
import { NotFoundError } from '../../utils/errors';

export async function seatsRoutes(app: FastifyInstance) {
  // GET /api/v1/events/:eventId/seats — Get all seats for an event
  app.get('/api/v1/events/:eventId/seats', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };

    // Resolve by id OR slug — the UI links to events by slug.
    // Cache value: `{ id }` on hit, `null` for a verified-missing event
    // (negative caching), `undefined` on cache miss/failure.
    const cachedEvent = await cacheGet<{ id: string } | null>(`event-id:${eventId}`);
    if (cachedEvent === null) throw new NotFoundError('Event', eventId);

    let eventRow: { id: string } | undefined = cachedEvent ?? undefined;
    if (!eventRow) {
      eventRow = (await prisma.event.findFirst({
        where: { OR: [{ id: eventId }, { slug: eventId }] },
        select: { id: true },
      })) ?? undefined;
      if (!eventRow) {
        // Negative cache so bogus-slug floods don't hammer Postgres
        await cacheSet(`event-id:${eventId}`, null, 10);
        throw new NotFoundError('Event', eventId);
      }
      await cacheSet(`event-id:${eventId}`, { id: eventRow.id }, 60);
    }
    const resolvedEventId = eventRow.id;

    const seats = await prisma.seat.findMany({
      where: { eventId: resolvedEventId },
      orderBy: [{ row: 'asc' }, { seatNumber: 'asc' }],
      select: {
        id: true,
        seatNumber: true,
        row: true,
        section: true,
        price: true,
        status: true,
      },
    });

    reply.send({ success: true, data: seats });
  });

  // GET /api/v1/events/:eventId/availability — Optimized availability summary
  app.get('/api/v1/events/:eventId/availability', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };

    const cacheKey = `event:${eventId}:availability`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) {
      reply.send(cached);
      return;
    }

    // Validate event exists
    const event = await prisma.event.findFirst({
      where: { OR: [{ id: eventId }, { slug: eventId }] },
    });
    if (!event) throw new NotFoundError('Event', eventId);

    const [totalSeats, availabilityBySection] = await Promise.all([
      prisma.seat.count({ where: { eventId: event.id } }),
      prisma.seat.groupBy({
        by: ['section', 'status'],
        where: { eventId: event.id },
        _count: true,
      }),
    ]);

    // Build availability map
    const sectionMap: Record<string, Record<string, number>> = {};
    let totalAvailable = 0;
    let totalBooked = 0;
    let totalHeld = 0;

    for (const group of availabilityBySection) {
      if (!sectionMap[group.section]) {
        sectionMap[group.section] = {};
      }
      sectionMap[group.section][group.status] = group._count;

      if (group.status === 'AVAILABLE') totalAvailable += group._count;
      else if (group.status === 'BOOKED') totalBooked += group._count;
      else if (group.status === 'HELD') totalHeld += group._count;
    }

    const result = {
      success: true,
      data: {
        eventId: event.id,
        totalSeats,
        availableSeats: totalAvailable,
        bookedSeats: totalBooked,
        heldSeats: totalHeld,
        sections: sectionMap,
      },
    };

    await cacheSet(cacheKey, result, 10); // Short TTL — availability is time-sensitive
    reply.send(result);
  });
}
