import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/prisma.js';
import { getRedis } from '../../plugins/redis.js';
import { NotFoundError } from '../../utils/errors.js';

export async function seatsRoutes(app: FastifyInstance) {
  // GET /api/v1/events/:eventId/seats — Get all seats for an event
  app.get('/api/v1/events/:eventId/seats', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };

    // Validate event exists
    const event = await prisma.event.findFirst({
      where: { OR: [{ id: eventId }, { slug: eventId }] },
    });
    if (!event) throw new NotFoundError('Event', eventId);

    const seats = await prisma.seat.findMany({
      where: { eventId: event.id },
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
    const redis = getRedis();

    const cacheKey = `event:${eventId}:availability`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.send(JSON.parse(cached));
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

    await redis.setex(cacheKey, 10, JSON.stringify(result)); // Short TTL for availability
    reply.send(result);
  });
}
