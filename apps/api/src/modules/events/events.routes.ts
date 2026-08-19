import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma.js';
import { getRedis } from '../../plugins/redis.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const createEventSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.string().min(1).max(50),
  venue: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  eventDate: z.string().datetime(),
  startTime: z.string(),
  endTime: z.string(),
  bannerUrl: z.string().url().optional(),
  seatCount: z.number().int().min(1).max(10000).optional(),
});

const updateEventSchema = createEventSchema.partial();

export async function eventsRoutes(app: FastifyInstance) {
  // GET /api/v1/events — List events with filtering, pagination, search
  app.get('/api/v1/events', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || '12', 10)));
    const skip = (page - 1) * limit;

    // Build cache key
    const cacheKey = `events:list:${JSON.stringify({ page, limit, ...query })}`;
    const redis = getRedis();

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.send(JSON.parse(cached));
      return;
    }

    // Build where clause
    const where: any = { status: 'PUBLISHED' };
    if (query.category) where.category = query.category;
    if (query.city) where.city = query.city;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { venue: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.dateFrom || query.dateTo) {
      where.eventDate = {};
      if (query.dateFrom) where.eventDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.eventDate.lte = new Date(query.dateTo);
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          seats: {
            select: { status: true },
          },
        },
        orderBy: { eventDate: 'asc' },
        skip,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);

    // Enrich with availability counts
    const enrichedEvents = events.map((event) => {
      const totalSeats = event.seats.length;
      const bookedSeats = event.seats.filter((s) => s.status === 'BOOKED' || s.status === 'HELD').length;
      const availableSeats = totalSeats - bookedSeats;
      const { seats, ...eventData } = event;
      return { ...eventData, totalSeats, availableSeats };
    });

    const result = {
      success: true,
      data: enrichedEvents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 30 seconds
    await redis.setex(cacheKey, 30, JSON.stringify(result));

    reply.send(result);
  });

  // GET /api/v1/events/:id — Event detail
  app.get('/api/v1/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const redis = getRedis();

    const cacheKey = `event:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.send(JSON.parse(cached));
      return;
    }

    const event = await prisma.event.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        _count: {
          select: {
            seats: { where: { status: 'BOOKED' } },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundError('Event', id);
    }

    const totalSeats = await prisma.seat.count({ where: { eventId: event.id } });
    const bookedSeats = event._count.seats;
    const availableSeats = totalSeats - bookedSeats;

    const result = {
      success: true,
      data: {
        ...event,
        _count: undefined,
        totalSeats,
        bookedSeats,
        availableSeats,
      },
    };

    await redis.setex(cacheKey, 30, JSON.stringify(result));
    reply.send(result);
  });

  // POST /api/v1/admin/events — Create event (admin only)
  app.post('/api/v1/admin/events', { preHandler: [requireAdmin] }, async (request, reply) => {
    const body = createEventSchema.parse(request.body);
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = await prisma.event.findUnique({ where: { slug } });
    if (existing) {
      throw new ValidationError('An event with this slug already exists');
    }

    const event = await prisma.event.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        category: body.category,
        venue: body.venue,
        city: body.city,
        eventDate: new Date(body.eventDate),
        startTime: body.startTime,
        endTime: body.endTime,
        bannerUrl: body.bannerUrl,
      },
    });

    // Generate seats if seatCount provided
    if (body.seatCount && body.seatCount > 0) {
      const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const seatsPerRow = Math.ceil(Math.sqrt(body.seatCount * 1.5));
      const totalRows = Math.ceil(body.seatCount / seatsPerRow);
      const seats: Array<{
        eventId: string;
        seatNumber: string;
        row: string;
        section: string;
        price: number;
      }> = [];

      let seatIndex = 0;
      for (let r = 0; r < totalRows && seatIndex < body.seatCount; r++) {
        const rowChar = rows[r];
        const section = r === 0 ? 'VIP' : r < totalRows * 0.3 ? 'PREMIUM' : 'GENERAL';
        const basePrice = section === 'VIP' ? 5000 : section === 'PREMIUM' ? 3000 : 1500;

        for (let s = 1; s <= seatsPerRow && seatIndex < body.seatCount; s++) {
          seats.push({
            eventId: event.id,
            seatNumber: `${rowChar}${String(s).padStart(2, '0')}`,
            row: rowChar,
            section,
            price: basePrice + Math.floor(Math.random() * 500),
          });
          seatIndex++;
        }
      }

      for (let i = 0; i < seats.length; i += 100) {
        await prisma.seat.createMany({ data: seats.slice(i, i + 100) });
      }

      logger.info({ eventId: event.id, seatCount: seats.length }, 'Seats generated for event');
    }

    // Invalidate cache
    const redis = getRedis();
    await redis.del('events:list:*' as any);

    reply.status(201).send({ success: true, data: event });
  });

  // PATCH /api/v1/admin/events/:id — Update event
  app.patch('/api/v1/admin/events/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateEventSchema.parse(request.body);

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event', id);

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description && { description: body.description }),
        ...(body.category && { category: body.category }),
        ...(body.venue && { venue: body.venue }),
        ...(body.city && { city: body.city }),
        ...(body.eventDate && { eventDate: new Date(body.eventDate) }),
        ...(body.startTime && { startTime: body.startTime }),
        ...(body.endTime && { endTime: body.endTime }),
        ...(body.bannerUrl && { bannerUrl: body.bannerUrl }),
      },
    });

    const redis = getRedis();
    await redis.del(`event:${id}`);
    await redis.del(`event:${event.slug}`);

    reply.send({ success: true, data: updated });
  });

  // DELETE /api/v1/admin/events/:id — Cancel event
  app.delete('/api/v1/admin/events/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundError('Event', id);

    await prisma.event.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    const redis = getRedis();
    await redis.del(`event:${id}`);

    reply.send({ success: true, message: 'Event cancelled' });
  });
}
