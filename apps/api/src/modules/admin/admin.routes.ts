import { FastifyInstance } from 'fastify';
import { prisma } from '../../plugins/prisma';
import { getRedis } from '../../plugins/redis';
import { requireAdmin } from '../../middleware/auth';

export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require ADMIN role
  app.addHook('preHandler', requireAdmin);

  // GET /api/v1/admin/dashboard — Admin dashboard metrics
  app.get('/api/v1/admin/dashboard', async (_request, reply) => {
    const [
      totalEvents,
      totalBookings,
      totalUsers,
      confirmedBookings,
      failedBookings,
      totalRevenue,
      seatsAvailable,
      seatsBooked,
    ] = await Promise.all([
      prisma.event.count(),
      prisma.booking.count(),
      prisma.user.count(),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { status: 'FAILED' } }),
      prisma.booking.aggregate({ _sum: { totalAmount: true }, where: { status: 'CONFIRMED' } }),
      prisma.seat.count({ where: { status: 'AVAILABLE' } }),
      prisma.seat.count({ where: { status: 'BOOKED' } }),
    ]);

    const redis = getRedis();
    const [bookingAttempts, bookingSuccess, bookingConflicts] = await Promise.all([
      redis.get('metrics:booking:attempts'),
      redis.get('metrics:booking:success'),
      redis.get('metrics:booking:conflicts'),
    ]);

    const successRate =
      confirmedBookings + failedBookings > 0
        ? ((confirmedBookings / (confirmedBookings + failedBookings)) * 100).toFixed(1)
        : '0.0';

    reply.send({
      success: true,
      data: {
        totalEvents,
        totalBookings,
        totalUsers,
        confirmedBookings,
        failedBookings,
        successRate: parseFloat(successRate),
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        seatsAvailable,
        seatsBooked,
        totalSeats: seatsAvailable + seatsBooked,
        metrics: {
          bookingAttempts: parseInt(bookingAttempts || '0', 10),
          bookingSuccess: parseInt(bookingSuccess || '0', 10),
          bookingConflicts: parseInt(bookingConflicts || '0', 10),
        },
      },
    });
  });

  // GET /api/v1/admin/bookings — List all bookings
  app.get('/api/v1/admin/bookings', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, parseInt(query.limit || '20', 10));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.eventId) where.eventId = query.eventId;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          event: { select: { id: true, name: true, eventDate: true } },
          bookingItems: {
            include: { seat: { select: { seatNumber: true, row: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    reply.send({
      success: true,
      data: bookings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/v1/admin/users — List users
  app.get('/api/v1/admin/users', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, parseInt(query.limit || '20', 10));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count(),
    ]);

    reply.send({
      success: true,
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // GET /api/v1/admin/analytics — Booking analytics
  app.get('/api/v1/admin/analytics', async (_request, reply) => {
    // Bookings per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookingsByDay = await prisma.$queryRaw<Array<{ date: string; count: bigint; revenue: string }>>`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM bookings
      WHERE created_at >= ${thirtyDaysAgo}
        AND status = 'CONFIRMED'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Bookings by event
    const bookingsByEvent = await prisma.$queryRaw<Array<{ eventName: string; count: bigint }>>`
      SELECT e.name as "eventName", COUNT(b.id) as count
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE b.status = 'CONFIRMED'
      GROUP BY e.name
      ORDER BY count DESC
      LIMIT 10
    `;

    // Bookings by status
    const bookingsByStatus = await prisma.booking.groupBy({
      by: ['status'],
      _count: true,
    });

    reply.send({
      success: true,
      data: {
        bookingsByDay: bookingsByDay.map((row) => ({
          date: row.date,
          count: Number(row.count),
          revenue: parseFloat(row.revenue),
        })),
        bookingsByEvent: bookingsByEvent.map((row) => ({
          eventName: row.eventName,
          count: Number(row.count),
        })),
        bookingsByStatus: bookingsByStatus.map((row) => ({
          status: row.status,
          count: row._count,
        })),
      },
    });
  });

  // GET /api/v1/admin/audit-logs — Audit logs
  app.get('/api/v1/admin/audit-logs', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, parseInt(query.limit || '50', 10));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count(),
    ]);

    reply.send({
      success: true,
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // POST /api/v1/admin/events/:eventId/reset-seats — Reset all seats to AVAILABLE
  app.post('/api/v1/admin/events/:eventId/reset-seats', async (request, reply) => {
    const { eventId } = request.params as { eventId: string };

    await prisma.seat.updateMany({
      where: { eventId },
      data: { status: 'AVAILABLE', bookedBy: null },
    });

    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'PUBLISHED' },
    });

    const redis = getRedis();
    await redis.del(`event:${eventId}:availability`);
    await redis.del(`event:${eventId}`);

    reply.send({ success: true, message: 'All seats reset to AVAILABLE' });
  });
}
