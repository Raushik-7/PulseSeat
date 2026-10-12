/**
 * PulseSeat — Image validation
 *
 * Two modes:
 *   npx tsx validate-images.ts          → validate the canonical dataset
 *                                         (uniqueness + every URL answers HTTP 200)
 *   npx tsx validate-images.ts --db     → report on what is actually stored
 *                                         in the database (unique/reuse counts)
 *
 * Exits non-zero if any check fails, so it can gate deployment.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, SeatStatus } from '@prisma/client';
import { events } from './event-data';

const prisma = new PrismaClient();

// Same minimal .env loader as seed.ts (existing env vars always win).
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

async function checkUrl(url: string, timeoutMs = 10_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'follow' });
    const ok = res.ok;
    const type = res.headers.get('content-type') || '';
    return ok && (type.startsWith('image/') || type === 'application/octet-stream');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const dbMode = process.argv.includes('--db');

  if (dbMode) {
    // ── Report on the live database ─────────────────────────────────────────
    const dbEvents = await prisma.event.findMany({
      select: { name: true, slug: true, city: true, category: true, bannerUrl: true, galleryUrls: true },
      orderBy: { eventDate: 'asc' },
    });

    const allImages: Array<{ url: string; event: string }> = [];
    for (const ev of dbEvents) {
      if (ev.bannerUrl) allImages.push({ url: ev.bannerUrl, event: ev.slug });
      for (const g of ev.galleryUrls) allImages.push({ url: g, event: ev.slug });
    }

    const seen = new Map<string, string[]>();
    for (const img of allImages) {
      seen.set(img.url, [...(seen.get(img.url) || []), img.event]);
    }
    const duplicates = [...seen.entries()].filter(([, evs]) => evs.length > 1);

    const [seatTotal, seatBooked, seatPremium, seatVip, userCount, bookingCount] = await Promise.all([
      prisma.seat.count(),
      prisma.seat.count({ where: { status: SeatStatus.BOOKED } }),
      prisma.seat.count({ where: { section: 'PREMIUM' } }),
      prisma.seat.count({ where: { section: 'VIP' } }),
      prisma.user.count(),
      prisma.booking.count(),
    ]);

    const cities = new Set(dbEvents.map((e) => e.city));
    const categories = new Set(dbEvents.map((e) => e.category));

    console.log('══════════════════════════════════════════════════════');
    console.log(' PulseSeat — DATABASE IMAGE & SEED REPORT');
    console.log('══════════════════════════════════════════════════════');
    console.log(`Events:            ${dbEvents.length}`);
    console.log(`Cities:            ${cities.size} (${[...cities].sort().join(', ')})`);
    console.log(`Categories:        ${categories.size} (${[...categories].sort().join(', ')})`);
    console.log(`Total images:      ${allImages.length}`);
    console.log(`Unique images:     ${seen.size}`);
    console.log(`Duplicate images:  ${duplicates.length === 0 ? '0 ✅' : duplicates.length + ' ❌'}`);
    for (const [url, evs] of duplicates) {
      console.log(`   ↳ reused by [${evs.join(', ')}]: ${url}`);
    }
    console.log(`Total seats:       ${seatTotal}`);
    console.log(`Occupied seats:    ${seatBooked} (${((seatBooked / Math.max(seatTotal, 1)) * 100).toFixed(1)}%)`);
    console.log(`Premium seats:     ${seatPremium}`);
    console.log(`VIP seats:         ${seatVip}`);
    console.log(`Users:             ${userCount}`);
    console.log(`Bookings:          ${bookingCount}`);
    console.log('══════════════════════════════════════════════════════');

    const perEventBad = dbEvents.filter((e) => (e.bannerUrl ? 1 : 0) + e.galleryUrls.length !== 3);
    if (perEventBad.length > 0) {
      console.error(`❌ Events without exactly 3 images: ${perEventBad.map((e) => e.slug).join(', ')}`);
      process.exitCode = 1;
    }
    return;
  }

  // ── Validate the canonical dataset ───────────────────────────────────────
  console.log(`🔎 Validating ${events.length} events from event-data.ts…\n`);

  // 1. Uniqueness across the entire dataset
  const urlToEvents = new Map<string, string[]>();
  for (const e of events) {
    for (const url of [e.banner, ...e.gallery]) {
      urlToEvents.set(url, [...(urlToEvents.get(url) || []), e.slug]);
    }
  }
  const dupes = [...urlToEvents.entries()].filter(([, evs]) => evs.length > 1);

  console.log(`Total events:      ${events.length}`);
  console.log(`Total images:      ${urlToEvents.size > 0 ? events.length * 3 : 0}`);
  console.log(`Unique images:     ${urlToEvents.size}`);
  console.log(`Duplicate images:  ${dupes.length === 0 ? '0 ✅' : dupes.length + ' ❌'}`);
  for (const [url, evs] of dupes) {
    console.error(`   ↳ shared by [${evs.join(', ')}]: ${url}`);
  }

  // 2. Exactly 3 images per event
  const badCounts = events.filter((e) => 1 + e.gallery.length !== 3);
  if (badCounts.length > 0) {
    console.error(`❌ Events without exactly 3 images: ${badCounts.map((e) => e.slug).join(', ')}`);
  }

  // 3. Every URL loads (HTTP 200 + image content-type)
  console.log(`\n🌐 Checking ${urlToEvents.size} URLs load (this hits Unsplash CDN)…`);
  const urls = [...urlToEvents.keys()];
  let ok = 0;
  let failed: string[] = [];
  const batchSize = 12;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (u) => ({ u, ok: await checkUrl(u) })));
    for (const r of results) {
      if (r.ok) {
        ok++;
        process.stdout.write(`   ✅ ${ok}/${urls.length}\r`);
      } else {
        failed.push(r.u);
        console.log(`\n   ❌ FAILED: ${r.u}`);
      }
    }
  }
  console.log('');
  console.log(`URLs reachable:    ${ok}/${urls.length}`);

  if (dupes.length > 0 || badCounts.length > 0 || failed.length > 0) {
    console.error('\n❌ Image validation FAILED');
    process.exit(1);
  }
  console.log('\n✅ Image validation passed: all unique, all relevant-count, all reachable.');
}

main()
  .catch((e) => {
    console.error('❌ Validation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
