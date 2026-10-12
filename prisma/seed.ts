import * as fs from 'fs';
import * as path from 'path';
import {
  PrismaClient,
  SeatStatus,
  UserRole,
  BookingStatus,
  PaymentStatus,
  PaymentProviderType,
} from '@prisma/client';
import * as crypto from 'crypto';
import { events, generateSeats, tierKeyByCategory } from './event-data';

const prisma = new PrismaClient();

// Minimal .env loader (no dependency): loads prisma/.env if present.
// Existing process env vars always win, so Supabase URLs passed in the shell
// (PowerShell $env: / Git Bash inline) are never overridden.
(() => {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
})();

// ─── Mode flags ──────────────────────────────────────────────────────────────
// DEFAULT (recommended for production): additive + idempotent. Never deletes.
//   - Events are upserted by slug (create if new, refresh text/images if existing).
//   - Seats are generated ONLY for newly created events, so existing bookings
//     and seat state are never touched.
// SEED_LOAD_USERS=1  → also create the 600 k6 load-test users (dev only).
// SEED_RESET=1       → DESTRUCTIVE: truncate all tables first. Dev/local only!
const RESET = process.env.SEED_RESET === '1' || process.argv.includes('--reset');
const INCLUDE_LOAD_USERS = process.env.SEED_LOAD_USERS === '1';

const CHUNK = 100;

// Must match apps/api hashPassword (HMAC-SHA256 with the app's salt) so seeded
// credentials actually work with password login.
function hashPassword(password: string): string {
  return crypto.createHmac('sha256', 'pulseseat-salt').update(password).digest('hex');
}

const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Deterministic booking reference derived from the event slug → re-runs are no-ops. */
function bookingRefFor(slug: string, index: number): string {
  let h = 0;
  const key = `${slug}#${index}`;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h) + key.charCodeAt(i);
    h |= 0;
  }
  let ref = 'PS-';
  for (let i = 0; i < 6; i++) {
    ref += REF_CHARS[Math.abs(h + i * 31) % REF_CHARS.length];
  }
  return ref;
}

async function chunkedCreateMany<T>(table: 'seat' | 'user', rows: T[]): Promise<number> {
  let created = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    if (table === 'seat') {
      const res = await prisma.seat.createMany({ data: slice as never, skipDuplicates: true });
      created += res.count;
    } else {
      const res = await prisma.user.createMany({ data: slice as never, skipDuplicates: true });
      created += res.count;
    }
  }
  return created;
}

async function upsertDemoUser(email: string, name: string, password: string, role: UserRole) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { user: existing, created: false };
  const user = await prisma.user.create({
    data: { email, name, passwordHash: hashPassword(password), role, emailVerified: true },
  });
  return { user, created: true };
}

async function main() {
  const target = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
  console.log('🌱 Seeding PulseSeat (production-safe, idempotent)…');
  console.log(`   Target: ${target ? `${target.hostname}:${target.port || '5432'}` : 'DATABASE_URL not set'}`);
  if (target && target.port === '6543') {
    console.log('   ⚠ Pooler URL detected — fine for seeding, but migrations need DIRECT_URL.');
    if (!target.searchParams.has('pgbouncer')) {
      console.log('   💡 Tip: append ?pgbouncer=true to the pooled URL — PgBouncer transaction mode');
      console.log('      otherwise breaks Prisma prepared statements ("prepared statement does not exist").');
    }
  }
  console.log('');

  if (RESET) {
    console.log('🧨 SEED_RESET=1 — DESTRUCTIVE mode: truncating ALL tables (dev only)!');
    await prisma.$executeRaw`TRUNCATE TABLE audit_logs, idempotency_keys, payments, booking_items, bookings, seats, events, users CASCADE`;
    console.log('   All tables truncated.');
    console.log('');
  }

  // ─── Demo users (create-if-missing, never update/delete) ──────────────────
  console.log('👤 Ensuring demo users…');
  const admin = await upsertDemoUser('admin@pulseseat.dev', 'Admin', 'admin123', UserRole.ADMIN);
  const demoUser = await upsertDemoUser('user@pulseseat.dev', 'Demo User', 'user123', UserRole.USER);
  const loadUser = await upsertDemoUser('loadtest@pulseseat.dev', 'Load Test User', 'loadtest123', UserRole.USER);
  const usersCreated = [admin, demoUser, loadUser].filter((u) => u.created).length;
  console.log(`   users created: ${usersCreated}, existing preserved: ${3 - usersCreated}`);

  // ─── Events: upsert by slug ───────────────────────────────────────────────
  console.log('🎪 Upserting events…');
  let created = 0;
  let updated = 0;
  let seatsCreated = 0;

  for (const e of events) {
    const existing = await prisma.event.findUnique({ where: { slug: e.slug } });

    if (!existing) {
      const event = await prisma.event.create({
        data: {
          name: e.name,
          slug: e.slug,
          description: e.description,
          shortDescription: e.shortDescription,
          category: e.category,
          venue: e.venue,
          address: e.address,
          city: e.city,
          eventDate: e.eventDate,
          startTime: e.startTime,
          endTime: e.endTime,
          bannerUrl: e.banner,
          galleryUrls: e.gallery,
          highlights: e.highlights,
          status: e.status,
        },
      });

      const seats = generateSeats(event.id, e.slug, e.seats, tierKeyByCategory[e.category]);
      seatsCreated += await chunkedCreateMany('seat', seats);
      created++;
      console.log(`   ➕ ${e.name} — ${seats.length} seats (${e.city})`);
    } else {
      // Refresh editable copy but never touch status (protects SOLD_OUT/CANCELLED)
      // and never touch seats (protects real bookings & seat state).
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          name: e.name,
          description: e.description,
          shortDescription: e.shortDescription,
          category: e.category,
          venue: e.venue,
          address: e.address,
          city: e.city,
          eventDate: e.eventDate,
          startTime: e.startTime,
          endTime: e.endTime,
          bannerUrl: e.banner,
          galleryUrls: e.gallery,
          highlights: e.highlights,
        },
      });
      updated++;
    }
  }
  console.log(`   events: ${created} created, ${updated} updated (of ${events.length} in dataset)`);
  console.log(`   seats created this run: ${seatsCreated}`);

  // ─── Deterministic sample bookings (real Booking rows, idempotent) ────────
  console.log('🎟️  Ensuring sample bookings (first 4 events)…');
  let bookingsCreated = 0;
  for (const [idx, e] of events.slice(0, 4).entries()) {
    const bookingReference = bookingRefFor(e.slug, idx);
    const already = await prisma.booking.findUnique({ where: { bookingReference } });
    if (already) continue;

    const event = await prisma.event.findUnique({ where: { slug: e.slug } });
    if (!event) continue;

    const seats = await prisma.seat.findMany({
      where: { eventId: event.id, status: SeatStatus.AVAILABLE },
      orderBy: { seatNumber: 'asc' },
      take: 2,
    });
    if (seats.length === 0) continue;

    const user = idx % 2 === 0 ? demoUser.user : loadUser.user;
    const totalAmount = seats.reduce((sum, s) => sum + Number(s.price), 0);

    await prisma.booking.create({
      data: {
        userId: user.id,
        eventId: event.id,
        bookingReference,
        status: BookingStatus.CONFIRMED,
        totalAmount,
        paymentStatus: PaymentStatus.PAID,
        bookingItems: { create: seats.map((s) => ({ seatId: s.id, price: s.price })) },
        payments: {
          create: {
            provider: PaymentProviderType.MOCK,
            providerPaymentId: `mock_seed_${bookingReference}`,
            amount: totalAmount,
            currency: 'INR',
            status: PaymentStatus.PAID,
          },
        },
      },
    });

    await prisma.seat.updateMany({
      where: { id: { in: seats.map((s) => s.id) } },
      data: { status: SeatStatus.BOOKED, bookedBy: user.id },
    });
    bookingsCreated++;
  }
  console.log(`   sample bookings created: ${bookingsCreated} (skipped if already present)`);

  // ─── Load-test users (opt-in, dev only) ───────────────────────────────────
  let loadUsersCreated = 0;
  if (INCLUDE_LOAD_USERS) {
    console.log('🧪 SEED_LOAD_USERS=1 — creating 600 load-test users…');
    const rows = Array.from({ length: 600 }, (_, i) => ({
      email: `load${i}@loadtest.local`,
      name: `Load User ${i}`,
      passwordHash: hashPassword('LoadTest123!'),
      emailVerified: true,
    }));
    loadUsersCreated = await chunkedCreateMany('user', rows);
    console.log(`   load-test users created: ${loadUsersCreated}`);
  } else {
    console.log('🧪 Load-test users skipped (set SEED_LOAD_USERS=1 to include — dev only).');
  }

  // ─── Summary from the actual DB ───────────────────────────────────────────
  try {
    const [dbEvents, dbSeats, dbBooked, dbUsers] = await Promise.all([
      prisma.event.count(),
      prisma.seat.count(),
      prisma.seat.count({ where: { status: SeatStatus.BOOKED } }),
      prisma.user.count(),
    ]);
    const dbImages = await prisma.event.findMany({ select: { bannerUrl: true, galleryUrls: true } });
    const imageCount = dbImages.reduce((n, ev) => n + (ev.bannerUrl ? 1 : 0) + ev.galleryUrls.length, 0);

    console.log('');
    console.log('✅ Seed complete — database summary:');
    console.log(`   Events:  ${dbEvents}`);
    console.log(`   Images:  ${imageCount} (${(imageCount / Math.max(dbEvents, 1)).toFixed(1)} per event)`);
    console.log(`   Seats:   ${dbSeats} total, ${dbBooked} booked (${((dbBooked / Math.max(dbSeats, 1)) * 100).toFixed(1)}%)`);
    console.log(`   Users:   ${dbUsers}`);
  } catch (err) {
    // PgBouncer transaction pooling can break the concurrent summary counts even
    // when ALL data was written fine — never turn that into a failed seed.
    console.log('');
    console.log('✅ Seed data written successfully (events, seats, bookings, users).');
    console.log('ℹ️  Only the final summary queries failed — PgBouncer transaction-pooling +');
    console.log('   prepared-statement quirk ("prepared statement does not exist"), NOT a data');
    console.log('   problem. Fix: append ?pgbouncer=true to DATABASE_URL and re-run (idempotent),');
    console.log('   or verify counts via Supabase Table Editor / pnpm validate:images:db.');
    console.log(`   Detail: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
  console.log('');
  console.log('Test credentials: admin@pulseseat.dev / admin123 · user@pulseseat.dev / user123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
