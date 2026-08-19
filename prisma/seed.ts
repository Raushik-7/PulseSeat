import { PrismaClient, EventStatus, SeatStatus, UserRole, BookingStatus, PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function generateBookingReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'PS-';
  for (let i = 0; i < 6; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

async function main() {
  console.log('🌱 Seeding PulseSeat database...');

  // Clean existing data
  await prisma.$executeRaw`TRUNCATE TABLE audit_logs CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE idempotency_keys CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE payments CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE booking_items CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE bookings CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE seats CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE events CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE users CASCADE`;

  // ─── Users ──────────────────────────────────────────────────────────────────
  console.log('👤 Creating users...');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@pulseseat.dev',
      name: 'Admin',
      passwordHash: crypto.createHash('sha256').update('admin123').digest('hex'),
      role: UserRole.ADMIN,
    },
  });

  const demoUser = await prisma.user.create({
    data: {
      email: 'user@pulseseat.dev',
      name: 'Demo User',
      passwordHash: crypto.createHash('sha256').update('user123').digest('hex'),
      role: UserRole.USER,
    },
  });

  const loadTestUser = await prisma.user.create({
    data: {
      email: 'loadtest@pulseseat.dev',
      name: 'Load Test User',
      passwordHash: crypto.createHash('sha256').update('loadtest123').digest('hex'),
      role: UserRole.USER,
    },
  });

  console.log(`  Created ${3} users`);

  // ─── Events ─────────────────────────────────────────────────────────────────
  console.log('🎪 Creating events...');

  const events = [
    {
      name: 'PulseSeat Concurrency Arena',
      slug: 'concurrency-arena',
      description:
        'A special load-testing event designed to demonstrate high-concurrency booking behavior. This event has 500 seats and is the primary target for load testing demonstrations.',
      category: 'Technology',
      venue: 'Tech Convention Center',
      city: 'Bangalore',
      eventDate: new Date('2026-09-15'),
      startTime: '18:00',
      endTime: '22:00',
      status: EventStatus.PUBLISHED,
      seatCount: 500,
    },
    {
      name: 'Electronic Music Festival',
      slug: 'electronic-music-festival',
      description:
        'Three days of non-stop electronic music featuring world-class DJs and producers. An immersive audiovisual experience.',
      category: 'Music',
      venue: 'Sunrise Arena',
      city: 'Mumbai',
      eventDate: new Date('2026-10-05'),
      startTime: '20:00',
      endTime: '04:00',
      status: EventStatus.PUBLISHED,
      seatCount: 300,
    },
    {
      name: 'Cloud Native Conference 2026',
      slug: 'cloud-native-conference',
      description:
        'The premier cloud-native computing conference. Featuring talks on Kubernetes, microservices, and distributed systems.',
      category: 'Technology',
      venue: 'Innovation Hub',
      city: 'Pune',
      eventDate: new Date('2026-10-20'),
      startTime: '09:00',
      endTime: '18:00',
      status: EventStatus.PUBLISHED,
      seatCount: 200,
    },
    {
      name: 'Stand-Up Comedy Night',
      slug: 'standup-comedy-night',
      description:
        'An evening of laughter with India\'s top comedians. Guaranteed to leave you in splits.',
      category: 'Comedy',
      venue: 'Laugh Factory',
      city: 'Delhi',
      eventDate: new Date('2026-11-01'),
      startTime: '19:00',
      endTime: '22:00',
      status: EventStatus.PUBLISHED,
      seatCount: 150,
    },
    {
      name: 'Film Screening: Indie Night',
      slug: 'indie-film-night',
      description:
        'A curated selection of award-winning independent films from around the world. Includes filmmaker Q&A sessions.',
      category: 'Film',
      venue: 'Cinephile Theater',
      city: 'Mumbai',
      eventDate: new Date('2026-11-10'),
      startTime: '17:00',
      endTime: '23:00',
      status: EventStatus.PUBLISHED,
      seatCount: 100,
    },
    {
      name: 'Indian Premier League Final',
      slug: 'ipl-final',
      description:
        'The grand finale of the Indian Premier League cricket season. Watch the best teams battle it out for the championship.',
      category: 'Sports',
      venue: 'Wankhede Stadium',
      city: 'Mumbai',
      eventDate: new Date('2026-11-25'),
      startTime: '14:00',
      endTime: '22:00',
      status: EventStatus.PUBLISHED,
      seatCount: 250,
    },
    {
      name: 'Jazz Under the Stars',
      slug: 'jazz-under-stars',
      description:
        'A magical evening of jazz music under the open sky. Featuring international jazz artists.',
      category: 'Music',
      venue: 'Botanical Garden',
      city: 'Kolkata',
      eventDate: new Date('2026-12-01'),
      startTime: '18:00',
      endTime: '23:00',
      status: EventStatus.PUBLISHED,
      seatCount: 200,
    },
    {
      name: 'Dance Workshop: Contemporary',
      slug: 'contemporary-dance-workshop',
      description:
        'Learn contemporary dance techniques from world-renowned choreographers. Suitable for intermediate and advanced dancers.',
      category: 'Dance',
      venue: 'Movement Studio',
      city: 'Chennai',
      eventDate: new Date('2026-12-10'),
      startTime: '10:00',
      endTime: '16:00',
      status: EventStatus.DRAFT,
      seatCount: 50,
    },
  ];

  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const sections = ['VIP', 'PREMIUM', 'GENERAL'];

  for (const eventData of events) {
    const { seatCount, ...eventFields } = eventData;

    const event = await prisma.event.create({
      data: eventFields,
    });

    // Generate seats
    const seatsPerRow = Math.ceil(Math.sqrt(seatCount * 1.5));
    const totalRows = Math.ceil(seatCount / seatsPerRow);
    const seats: Array<{
      eventId: string;
      seatNumber: string;
      row: string;
      section: string;
      price: number;
    }> = [];

    let seatIndex = 0;
    for (let r = 0; r < totalRows && seatIndex < seatCount; r++) {
      const rowChar = rows[r];
      const section = r === 0 ? 'VIP' : r < totalRows * 0.3 ? 'PREMIUM' : 'GENERAL';
      const basePrice = section === 'VIP' ? 5000 : section === 'PREMIUM' ? 3000 : 1500;

      for (let s = 1; s <= seatsPerRow && seatIndex < seatCount; s++) {
        const seatNum = `${rowChar}${String(s).padStart(2, '0')}`;
        seats.push({
          eventId: event.id,
          seatNumber: seatNum,
          row: rowChar,
          section,
          price: basePrice + Math.floor(Math.random() * 500),
        });
        seatIndex++;
      }
    }

    // Batch insert seats
    for (let i = 0; i < seats.length; i += 100) {
      await prisma.seat.createMany({
        data: seats.slice(i, i + 100),
      });
    }

    console.log(`  🎪 ${event.name} — ${seats.length} seats (${sections.join('/')})`);
  }

  // ─── Sample Bookings ───────────────────────────────────────────────────────
  console.log('🎟️  Creating sample bookings...');

  const concurrencyEvent = await prisma.event.findUnique({
    where: { slug: 'concurrency-arena' },
  });

  if (concurrencyEvent) {
    const seats = await prisma.seat.findMany({
      where: { eventId: concurrencyEvent.id },
      orderBy: { seatNumber: 'asc' },
      take: 3,
    });

    if (seats.length > 0) {
      const booking = await prisma.booking.create({
        data: {
          userId: demoUser.id,
          eventId: concurrencyEvent.id,
          bookingReference: generateBookingReference(),
          status: BookingStatus.CONFIRMED,
          totalAmount: seats.reduce((sum, s) => sum + Number(s.price), 0),
          paymentStatus: PaymentStatus.PAID,
          bookingItems: {
            create: seats.map((s) => ({
              seatId: s.id,
              price: s.price,
            })),
          },
        },
      });

      // Mark seats as booked
      await prisma.seat.updateMany({
        where: { id: { in: seats.map((s) => s.id) } },
        data: { status: SeatStatus.BOOKED, bookedBy: demoUser.id },
      });

      console.log(`  Booking ${booking.bookingReference} — ${seats.length} seats`);
    }
  }

  // ─── Audit Logs ─────────────────────────────────────────────────────────────
  console.log('📋 Creating audit logs...');
  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, action: 'EVENT_CREATED', entityType: 'event', entityId: 'concurrency-arena' },
      { userId: admin.id, action: 'USER_ROLE_CHANGED', entityType: 'user', entityId: admin.id },
      { userId: demoUser.id, action: 'BOOKING_CONFIRMED', entityType: 'booking', entityId: 'sample' },
    ],
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Test credentials:');
  console.log('  Admin:  admin@pulseseat.dev / admin123');
  console.log('  User:   user@pulseseat.dev / user123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
