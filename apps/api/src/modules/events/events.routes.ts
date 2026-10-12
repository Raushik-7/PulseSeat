import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma';
import { cacheGet, cacheSet, cacheDel } from '../../plugins/redis-safe';
import { eventsListVersion, bumpEventsListVersion } from './events.cache';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';

const createEventSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  shortDescription: z.string().max(300).optional(),
  category: z.string().min(1).max(50),
  venue: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  address: z.string().max(300).optional(),
  eventDate: z.string().datetime(),
  startTime: z.string(),
  endTime: z.string(),
  bannerUrl: z.string().url().optional(),
  seatCount: z.number().int().min(1).max(10000).optional(),
});

const updateEventSchema = createEventSchema.partial();

// ─── List-cache versioning ─────────────────────────────────────────────────
// The list cache key embeds the raw query string, so mutations can't know
// every key to delete. Mutations instead bump a version counter that every
// list read folds into its cache key — instantly invalidating all variants.
// Falls back to version 0 (short 60s TTL bounds staleness) if Redis is down.
// List cache version helpers live in ./events.cache (shared with the booking
// service). Local duplicates removed.

export async function eventsRoutes(app: FastifyInstance) {
  // GET /api/v1/events — List events with filtering, pagination, search
  app.get('/api/v1/events', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || '12', 10)));
    const skip = (page - 1) * limit;

    // Build cache key. NOTE: the cache is an optimization only — if Redis is
    // unavailable (free-tier quota, network blip) we still serve the list
    // straight from Postgres. Cache failures used to 500 this endpoint, which
    // is how event cards vanished from the live site while the DB was fine.
    const listVersion = await eventsListVersion();
    const cacheKey = `events:list:v${listVersion}:${JSON.stringify({ page, limit, ...query })}`;

    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) {
      reply.send(cached);
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

    // Perf: instead of pulling every seat row per event (6,130 rows for a
    // 12-event page), one GROUP BY query computes the aggregate per event.
    // This was the heaviest query on the whole site.
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { eventDate: 'asc' },
        skip,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);

    // One GROUP BY for exactly the events on this page (instead of shipping
    // every seat row across the wire — 6,130 rows for a 12-event page).
    const pageEventIds = events.map((e) => e.id);
    const agg = pageEventIds.length
      ? await prisma.seat.groupBy({
          by: ['eventId', 'status'],
          where: { eventId: { in: pageEventIds } },
          _count: true,
          _min: { price: true },
        })
      : [];

    // Build per-event aggregates: { eventId: { total, booked, minAvailablePrice } }
    const stats: Record<string, { total: number; unavailable: number; minAvailable: number | null }> = {};
    for (const g of agg) {
      const s = (stats[g.eventId] ||= { total: 0, unavailable: 0, minAvailable: null });
      s.total += g._count;
      if (g.status === 'BOOKED' || g.status === 'HELD' || g.status === 'DISABLED') s.unavailable += g._count;
      if (g.status === 'AVAILABLE' && g._min.price != null) {
        const p = Number(g._min.price);
        s.minAvailable = s.minAvailable == null ? p : Math.min(s.minAvailable, p);
      }
    }

    // Enrich with availability counts and min price from the aggregate
    const enrichedEvents = events.map((event) => {
      const s = stats[event.id] || { total: 0, unavailable: 0, minAvailable: null };
      return {
        ...event,
        totalSeats: s.total,
        availableSeats: s.total - s.unavailable,
        minPrice: s.minAvailable ?? 0,
      };
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

    // Cache for 60 seconds (public listing tolerates brief staleness);
    // failure to cache is harmless and logged by the cache layer.
    await cacheSet(cacheKey, result, 60);

    reply.send(result);
  });

  // GET /api/v1/events/:id — Event detail
  app.get('/api/v1/events/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const cacheKey = `event:${id}`;
    const cached = await cacheGet<unknown>(cacheKey);
    if (cached) {
      reply.send(cached);
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

    await cacheSet(cacheKey, result, 60);
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
        shortDescription: body.shortDescription,
        category: body.category,
        venue: body.venue,
        city: body.city,
        address: body.address,
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

    // Invalidate list cache. The list key embeds the full query object, so a
    // single known key is not discoverable here — instead we bump an epoch
    // that list requests fold into their cache key (see list route).
    await bumpEventsListVersion();

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

    await cacheDel(`event:${id}`, `event:${event.slug}`);
    await bumpEventsListVersion();

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

    await cacheDel(`event:${id}`);
    await bumpEventsListVersion();

    reply.send({ success: true, message: 'Event cancelled' });
  });
}
