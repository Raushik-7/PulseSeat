/**
 * PulseSeat — Canonical event dataset (20 realistic Indian demo events).
 *
 * Single source of truth shared by `seed.ts` and `validate-images.ts`.
 * Events are demo events staged at real, recognizable Indian venues (no
 * fictional venue names). Every image URL is a stable Unsplash CDN URL whose
 * photo ID is unique across the whole dataset — exactly 60 distinct IDs.
 *
 * Note: real-world performer/league names are illustrative; these are demo
 * listings, not official event announcements.
 */
import { EventStatus } from '@prisma/client';

const img = (id: string, w = 800, h = 500) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format`;

// ─── Seat pricing tiers per event type ───────────────────────────────────────
export type Tier = { name: string; price: number };

export const TIER_MAP: Record<string, Tier[]> = {
  music:  [{ name: 'GENERAL', price: 1999 }, { name: 'PREMIUM', price: 3999 }, { name: 'VIP', price: 7999 }],
  tech:   [{ name: 'GENERAL', price: 1499 }, { name: 'PREMIUM', price: 2999 }, { name: 'VIP', price: 4999 }],
  comedy: [{ name: 'GENERAL', price: 799 },  { name: 'PREMIUM', price: 1499 }, { name: 'VIP', price: 2499 }],
  film:   [{ name: 'GENERAL', price: 499 },  { name: 'PREMIUM', price: 999 },  { name: 'VIP', price: 1799 }],
  sports: [{ name: 'GENERAL', price: 999 },  { name: 'PREMIUM', price: 2499 }, { name: 'VIP', price: 5999 }],
  dance:  [{ name: 'GENERAL', price: 599 },  { name: 'PREMIUM', price: 1199 }, { name: 'VIP', price: 2299 }],
};

export interface EventSeed {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: 'Music' | 'Technology' | 'Comedy' | 'Film' | 'Sports' | 'Dance';
  venue: string;
  address: string;
  city: string;
  eventDate: Date;
  startTime: string;
  endTime: string;
  status: EventStatus;
  seats: number;
  banner: string;
  gallery: [string, string];
  highlights: string[];
}

export const events: EventSeed[] = [
  // ─── Music (4) ────────────────────────────────────────────────────────────
  {
    name: 'Sunburn Arena: Arijit Singh Live',
    slug: 'sunburn-arena-arijit-singh',
    description:
      "The biggest voice of Indian music returns to the Sunburn Arena stage. An unforgettable night of soulful melodies and chart-topping Bollywood anthems under the open sky at DY Patil Stadium.",
    shortDescription:
      'Arijit Singh brings his soulful Bollywood anthems to the Sunburn Arena stage at DY Patil Stadium for one massive open-air night.',
    category: 'Music',
    venue: 'DY Patil Stadium',
    address: 'Sector 7, Nerul, Navi Mumbai, Maharashtra 400706',
    city: 'Mumbai',
    eventDate: new Date('2026-12-12'),
    startTime: '19:00',
    endTime: '23:00',
    status: EventStatus.PUBLISHED,
    seats: 480,
    banner: img('1470225620780-dba8ba36b745'),
    gallery: [img('1493225457124-a3eb161ffa5f'), img('1501386761578-eac5c94b800a')],
    highlights: ["India's biggest playback star live", 'Massive open-air arena production', 'Special guest opening act', 'Food courts & merchandise zones'],
  },
  {
    name: 'NH7 Weekender Pune 2027',
    slug: 'nh7-weekender-pune-2027',
    description:
      "India's happiest music festival is back at Mahalaxmi Lawns with 4 stages, 40+ artists across indie, electronic, and rock genres. Three days of pure musical magic in Pune.",
    shortDescription:
      "India's happiest music festival returns to Pune — 4 stages, 40+ artists, and three days of indie, electronic and rock magic.",
    category: 'Music',
    venue: 'Mahalaxmi Lawns',
    address: 'Sahakar Nagar, Karve Nagar, Pune, Maharashtra 411048',
    city: 'Pune',
    eventDate: new Date('2027-01-16'),
    startTime: '15:00',
    endTime: '23:30',
    status: EventStatus.PUBLISHED,
    seats: 420,
    banner: img('1511671782779-c97d3d27a1d4'),
    gallery: [img('1514320291840-2e0a9bf2a9ae'), img('1524368535928-5b5e00ddc76b')],
    highlights: ['4 stages, 40+ artists', 'Multi-day festival experience', 'Gourmet food & flea market', 'Craft beer garden'],
  },
  {
    name: 'Prateek Kuhad: Silhouettes Tour',
    slug: 'prateek-kuhad-silhouettes-tour',
    description:
      'An intimate evening with Prateek Kuhad performing his beloved discography — cold/mess, Kasoor and more — in an acoustically pristine heritage setting in the heart of Bengaluru.',
    shortDescription:
      'An intimate acoustic evening with Prateek Kuhad — cold/mess, Kasoor and more — in a heritage palace setting in Bengaluru.',
    category: 'Music',
    venue: 'Jayamahal Palace',
    address: '1st Main Road, Jayamahal Extension, Bengaluru, Karnataka 560046',
    city: 'Bengaluru',
    eventDate: new Date('2027-02-06'),
    startTime: '20:00',
    endTime: '23:00',
    status: EventStatus.PUBLISHED,
    seats: 260,
    banner: img('1459749411175-04bf5292ceea'),
    gallery: [img('1501612780327-45045538702b'), img('1429962714451-bb934ecdc4ec')],
    highlights: ['Intimate heritage-palace setting', 'Acoustic full-band performance', 'Fan-favourite setlist', 'Limited capacity show'],
  },
  {
    name: 'Indian Ocean: Live in Concert',
    slug: 'indian-ocean-live-hyderabad',
    description:
      'The pioneers of Indian rock fusion perform their legendary hits — Kandisa, Bandeh and Ma Rewa — live at Shilpakala Vedika. A night of timeless music by the lake.',
    shortDescription:
      'The pioneers of Indian rock fusion perform Kandisa, Bandeh and Ma Rewa live at Shilpakala Vedika, Hyderabad.',
    category: 'Music',
    venue: 'Shilpakala Vedika',
    address: 'Shilpa Layout, HITEC City, Madhapur, Hyderabad, Telangana 500081',
    city: 'Hyderabad',
    eventDate: new Date('2027-03-13'),
    startTime: '19:30',
    endTime: '22:30',
    status: EventStatus.PUBLISHED,
    seats: 300,
    banner: img('1516450360452-9312f5e86fc7'),
    gallery: [img('1470229722913-7c0e2dbbafd3'), img('1506157786151-b8491531f063')],
    highlights: ['Legends of Indian rock fusion', 'Acoustics-rated indoor venue', '25+ year musical legacy', 'Classic hits setlist'],
  },

  // ─── Technology (4) ───────────────────────────────────────────────────────
  {
    name: 'AWS Community Day India 2027',
    slug: 'aws-community-day-india-2027',
    description:
      'The largest community-driven cloud conference in India. Deep-dive sessions on serverless, Kubernetes, AI/ML workloads and cloud architecture from practitioners building at scale.',
    shortDescription:
      "India's largest community-driven cloud conference — deep dives on serverless, Kubernetes and AI/ML from practitioners at scale.",
    category: 'Technology',
    venue: 'NIMHANS Convention Centre',
    address: 'Hosur Road, Lakkasandra, Someshwara Nagar, Bengaluru, Karnataka 560029',
    city: 'Bengaluru',
    eventDate: new Date('2026-10-24'),
    startTime: '09:00',
    endTime: '18:30',
    status: EventStatus.PUBLISHED,
    seats: 380,
    banner: img('1540575467063-178a50c2df87'),
    gallery: [img('1505373877841-8d25f7d46678'), img('1475721027785-f74eccf877e2')],
    highlights: ['40+ practitioner-led sessions', 'Hands-on cloud labs', 'AWS heroes & solution architects', 'Networking with 1000+ builders'],
  },
  {
    name: 'GitHub Dev Summit India',
    slug: 'github-dev-summit-india',
    description:
      'A full-day celebration of software craft at Jio World Convention Centre — Copilot deep dives, open-source showcases, live coding battles and the future of AI-assisted development.',
    shortDescription:
      'A full-day celebration of software craft at Jio World Convention Centre — Copilot deep dives, live coding and open source.',
    category: 'Technology',
    venue: 'Jio World Convention Centre',
    address: 'G Block, Bandra Kurla Complex, Mumbai, Maharashtra 400098',
    city: 'Mumbai',
    eventDate: new Date('2026-11-21'),
    startTime: '09:30',
    endTime: '19:00',
    status: EventStatus.PUBLISHED,
    seats: 350,
    banner: img('1519389950473-47ba0277781c'),
    gallery: [img('1531482615713-2afd69097998'), img('1556761175-5973dc0f32e7')],
    highlights: ['AI coding keynote & demos', 'Live hack arena', 'Open-source maintainer meetups', 'Developer swag & certification desk'],
  },
  {
    name: 'DevOps Days India 2027',
    slug: 'devops-days-india-2027',
    description:
      'Two days of everything DevOps — platform engineering, SRE war stories, observability masterclasses and lightning talks at HITEX Hyderabad.',
    shortDescription:
      'Two days of platform engineering, SRE war stories and observability masterclasses at HITEX Hyderabad.',
    category: 'Technology',
    venue: 'HITEX Exhibition Centre',
    address: 'Izzathnagar, near Cyber Towers, Hyderabad, Telangana 500084',
    city: 'Hyderabad',
    eventDate: new Date('2027-01-30'),
    startTime: '09:00',
    endTime: '17:30',
    status: EventStatus.PUBLISHED,
    seats: 280,
    banner: img('1461749280684-dccba630e2f6'),
    gallery: [img('1526374965328-7f61d4dc18c5'), img('1558494949-ef010cbdcc31')],
    highlights: ['SRE & platform engineering tracks', 'Open-space unconference', 'Tooling vendor showcase', 'CI/CD workshop labs'],
  },
  {
    name: 'AI India Summit 2027',
    slug: 'ai-india-summit-2027',
    description:
      "Where India's AI ecosystem converges. Foundational model demos, applied GenAI case studies, startup expo and policy roundtables at India Expo Centre, Delhi NCR.",
    shortDescription:
      "Where India's AI ecosystem converges — GenAI case studies, a 50+ startup expo and policy roundtables in Delhi NCR.",
    category: 'Technology',
    venue: 'India Expo Centre & Mart',
    address: 'Knowledge Park, Greater Noida Expressway, Delhi NCR 201310',
    city: 'New Delhi',
    eventDate: new Date('2027-02-20'),
    startTime: '08:30',
    endTime: '19:00',
    status: EventStatus.PUBLISHED,
    seats: 450,
    banner: img('1504639725590-34d0984388bd'),
    gallery: [img('1517430816045-df4b7de11d1d'), img('1485827404703-89b55fcc595e')],
    highlights: ['GenAI application showcases', '50+ startup expo booths', 'Research & policy tracks', 'Startup pitch arena'],
  },

  // ─── Comedy (3) ───────────────────────────────────────────────────────────
  {
    name: 'Zakir Khan Live: Tathastu',
    slug: 'zakir-khan-tathastu',
    description:
      'The Sakht Launda is back with his biggest tour yet. An evening of raw storytelling, hard-hitting punchlines and full-house laughter at Good Shepherd Auditorium.',
    shortDescription:
      'The Sakht Launda returns with his biggest tour yet — raw storytelling and full-house laughter at Good Shepherd Auditorium.',
    category: 'Comedy',
    venue: 'Good Shepherd Auditorium',
    address: 'Museum Rd, Shanthala Nagar, Ashok Nagar, Bengaluru, Karnataka 560001',
    city: 'Bengaluru',
    eventDate: new Date('2026-12-05'),
    startTime: '19:00',
    endTime: '21:30',
    status: EventStatus.PUBLISHED,
    seats: 220,
    banner: img('1585699324551-f6c309eedeca'),
    gallery: [img('1527224857830-43a7acc85260'), img('1516280440614-37939bbacd81')],
    highlights: ["India's biggest stand-up star", 'Brand-new hour of material', 'Intimate auditorium setting', 'Meet & greet VIP option'],
  },
  {
    name: 'Canvas Comedy All-Stars',
    slug: 'canvas-comedy-all-stars',
    description:
      "A rotating line-up of India's sharpest comedians share one stage for a night of improv, roast and rapid-fire stand-up. No two shows are ever the same.",
    shortDescription:
      "India's sharpest comedians share one stage for improv, roast and rapid-fire stand-up. No two shows alike.",
    category: 'Comedy',
    venue: "St. Andrew's Auditorium",
    address: 'St. Andrews Rd, Chembur, Mumbai, Maharashtra 400071',
    city: 'Mumbai',
    eventDate: new Date('2027-01-23'),
    startTime: '20:00',
    endTime: '22:30',
    status: EventStatus.PUBLISHED,
    seats: 180,
    banner: img('1478737270239-2f02b77fc618'),
    gallery: [img('1598488035139-bdbb2231ce04'), img('1503095396549-807759245b35')],
    highlights: ['Multiple comedians, one night', 'Surprise drop-in sets', 'Improv & audience games', '18+ adults only show'],
  },
  {
    name: 'Anubhav Singh Bassi Live',
    slug: 'anubhav-singh-bassi-live',
    description:
      'From hostel tales to career confessions — Bassi brings his viral storytelling style to Tagore Theatre Chandigarh for two sidesplitting shows.',
    shortDescription:
      'From hostel tales to career confessions — Bassi brings his viral storytelling comedy to Tagore Theatre, Chandigarh.',
    category: 'Comedy',
    venue: 'Tagore Theatre',
    address: 'Sector 18B, Chandigarh 160018',
    city: 'Chandigarh',
    eventDate: new Date('2027-02-27'),
    startTime: '18:30',
    endTime: '21:00',
    status: EventStatus.PUBLISHED,
    seats: 200,
    banner: img('1507924538820-ede94a04019d'),
    gallery: [img('1492684223066-81342ee5ff30'), img('1522071820081-009f0129c71c')],
    highlights: ['Viral storytelling comedy', 'Hinglish crowd-pleasers', 'Two shows, one day', 'Merch counter on-site'],
  },

  // ─── Film (3) ─────────────────────────────────────────────────────────────
  {
    name: 'International Film Festival of India — Goa Showcase',
    slug: 'iffi-goa-showcase',
    description:
      'A curated showcase of award-winning world cinema along the Mandovi — premieres, masterclasses with acclaimed directors and open-air screenings at Kala Academy.',
    shortDescription:
      'Award-winning world cinema on the Mandovi — premieres, director masterclasses and open-air screenings at Kala Academy.',
    category: 'Film',
    venue: 'Kala Academy',
    address: 'Campal, Panaji, Goa 403001',
    city: 'Goa',
    eventDate: new Date('2026-11-28'),
    startTime: '10:00',
    endTime: '22:30',
    status: EventStatus.PUBLISHED,
    seats: 240,
    banner: img('1489599849927-2ee91cede3ba'),
    gallery: [img('1440404653325-ab127d49abc1'), img('1478720568477-152d9b164e26')],
    highlights: ['World cinema premieres', 'Director masterclasses', 'Open-air riverside screenings', 'Festival delegate lounge'],
  },
  {
    name: 'Bengaluru International Film Festival',
    slug: 'bengaluru-international-film-festival',
    description:
      'Nine days of independent and mainstream cinema from 40 countries at the iconic Bangalore Palace grounds — retrospectives, shorts competition and indie market.',
    shortDescription:
      'Nine days of cinema from 40 countries at Bangalore Palace — retrospectives, shorts competition and indie market.',
    category: 'Film',
    venue: 'Bangalore Palace Grounds',
    address: 'Jayamahal Rd, Vasanth Nagar, Bengaluru, Karnataka 560052',
    city: 'Bengaluru',
    eventDate: new Date('2027-03-06'),
    startTime: '09:00',
    endTime: '23:00',
    status: EventStatus.PUBLISHED,
    seats: 300,
    banner: img('1536440136628-849c177e76a1'),
    gallery: [img('1485846234645-a62644f84728'), img('1517604931442-7e0c8ed2963c')],
    highlights: ['40+ countries represented', 'Heritage palace venue', 'Shorts competition section', 'Indie film market'],
  },
  {
    name: 'Kolkata International Film Week',
    slug: 'kolkata-international-film-week',
    description:
      "Celebrating a century of Bengali cinema alongside contemporary world films at the iconic Nandan complex — the cultural heart of Kolkata's film scene.",
    shortDescription:
      "A century of Bengali cinema meets contemporary world film at Nandan — the cultural heart of Kolkata's film scene.",
    category: 'Film',
    venue: 'Nandan Complex',
    address: '1/1 A.J.C. Bose Road, Kolkata, West Bengal 700020',
    city: 'Kolkata',
    eventDate: new Date('2027-04-10'),
    startTime: '11:00',
    endTime: '22:00',
    status: EventStatus.PUBLISHED,
    seats: 210,
    banner: img('1524985069026-dd778a71c7b4'),
    gallery: [img('1616530940355-351fabd9524b'), img('1574267432553-4b4628081c31')],
    highlights: ['Bengali cinema centenary retrospective', 'Nandan heritage theatres', 'Restored classics section', 'Filmmaker Q&A sessions'],
  },

  // ─── Sports (3) ───────────────────────────────────────────────────────────
  {
    name: 'IPL 2027 Grand Final',
    slug: 'ipl-2027-grand-final',
    description:
      "The summit clash of India's premier T20 carnival at the world's largest cricket stadium. 132,000 voices, one trophy — an atmosphere unlike anything else in sport.",
    shortDescription:
      "The summit clash of India's premier T20 carnival at the world's largest cricket stadium. 132,000 voices, one trophy.",
    category: 'Sports',
    venue: 'Narendra Modi Stadium',
    address: 'Narendra Modi Stadium, Motera, Ahmedabad, Gujarat 380005',
    city: 'Ahmedabad',
    eventDate: new Date('2027-05-30'),
    startTime: '19:30',
    endTime: '23:00',
    status: EventStatus.PUBLISHED,
    seats: 500,
    banner: img('1574629810360-7efbbe195018'),
    gallery: [img('1540747913346-19e32dc3e97e'), img('1552674605-db6ffd4facb5')],
    highlights: ["World's largest cricket stadium", 'Season-deciding final', 'Fireworks & closing ceremony', 'Corporate box options'],
  },
  {
    name: 'Pro Kabaddi League Grand Finale',
    slug: 'pro-kabaddi-grand-finale',
    description:
      "Mataanudi at its finest — the PKL season final under the lights at Chennai's iconic Nehru Stadium. Raids, tackles and championship glory.",
    shortDescription:
      "The PKL season final under the lights at Chennai's iconic Nehru Stadium — raids, tackles and championship glory.",
    category: 'Sports',
    venue: 'Jawaharlal Nehru Indoor Stadium',
    address: 'Sydenhams Rd, Park Town, Chennai, Tamil Nadu 600003',
    city: 'Chennai',
    eventDate: new Date('2027-08-07'),
    startTime: '19:00',
    endTime: '22:00',
    status: EventStatus.PUBLISHED,
    seats: 350,
    banner: img('1531415074968-036ba1b575da'),
    gallery: [img('1546519638-68e109498ffc'), img('1579952363873-27f3bade9f55')],
    highlights: ['PKL championship decider', 'Indoor stadium atmosphere', 'Cheer squads & drumlines', 'Post-match trophy ceremony'],
  },
  {
    name: 'ISL Cup: Kerala Blasters vs Mumbai City',
    slug: 'isl-cup-kerala-blasters',
    description:
      'The roaring Yellow Sea of Kochi hosts this blockbuster ISL cup clash. European-grade football, 60,000 strong ultras and a Kerala night to remember.',
    shortDescription:
      'The roaring Yellow Sea of Kochi hosts a blockbuster ISL cup clash — European-grade football and 60,000 strong ultras.',
    category: 'Sports',
    venue: 'Jawaharlal Nehru Stadium',
    address: 'Kaloor, Kochi, Kerala 682017',
    city: 'Kochi',
    eventDate: new Date('2027-01-09'),
    startTime: '19:30',
    endTime: '22:00',
    status: EventStatus.PUBLISHED,
    seats: 380,
    banner: img('1522778119026-d647f0596c20'),
    gallery: [img('1541257710737-06d667133a53'), img('1517649763962-0c623066013b')],
    highlights: ['The famous Yellow Sea ultras', 'ISL cup knockout clash', 'Riverfront stadium setting', 'Fan zone opens 3 hours early'],
  },

  // ─── Dance (3) ────────────────────────────────────────────────────────────
  {
    name: 'Kalakshetra Classical Dance Festival',
    slug: 'kalakshetra-classical-festival',
    description:
      "An evening of Bharatanatyam, Kathak and Odissi by India's finest classical dancers at the legendary Kalakshetra Foundation — where tradition meets transcendence.",
    shortDescription:
      "Bharatanatyam, Kathak and Odissi by India's finest classical dancers at the legendary Kalakshetra Foundation.",
    category: 'Dance',
    venue: 'Kalakshetra Foundation',
    address: 'Thiruvanmiyur, Chennai, Tamil Nadu 600041',
    city: 'Chennai',
    eventDate: new Date('2026-12-19'),
    startTime: '18:30',
    endTime: '21:30',
    status: EventStatus.PUBLISHED,
    seats: 200,
    banner: img('1508700929628-666bc8bd84ea'),
    gallery: [img('1518834107812-67b0b7c58434'), img('1535525153412-5a42439a210d')],
    highlights: ['Padma-awardee performers', 'Heritage coastal campus', 'Live orchestra & percussion', 'Pre-show art exhibition'],
  },
  {
    name: 'India Boogie: Hip-Hop Dance Championship',
    slug: 'india-boogie-hiphop-championship',
    description:
      'Crews from 15 cities battle it out for the national crown — breaking, popping, krump and all-styles divisions at Rajasthan International Centre, Jaipur.',
    shortDescription:
      'Crews from 15 cities battle for the national crown — breaking, popping, krump and all-styles at Rajasthan International Centre.',
    category: 'Dance',
    venue: 'Rajasthan International Centre',
    address: 'JLN Marg, Jaipur, Rajasthan 302004',
    city: 'Jaipur',
    eventDate: new Date('2027-03-20'),
    startTime: '17:00',
    endTime: '23:00',
    status: EventStatus.PUBLISHED,
    seats: 250,
    banner: img('1508807526345-15e9b5f4eaff'),
    gallery: [img('1520367445093-50dc08a59d9d'), img('1519671482749-fd09be7ccebf')],
    highlights: ['15-city crew battle', '4 dance divisions', 'International judge panel', 'DJ bazaar & sneaker expo'],
  },
  {
    name: 'Contemporary Dance Biennale',
    slug: 'contemporary-dance-biennale',
    description:
      "India's premier contemporary dance festival returns to Lucknow — premiering six new works from leading choreographers, fusing Kathak heritage with modern movement language.",
    shortDescription:
      "Six world-premiere works fusing Kathak heritage with modern movement at Lucknow's premier contemporary dance festival.",
    category: 'Dance',
    venue: 'Sangeet Natak Akademi Auditorium',
    address: '1, Vipin Khand, Gomti Nagar, Lucknow, Uttar Pradesh 226010',
    city: 'Lucknow',
    eventDate: new Date('2027-04-24'),
    startTime: '19:00',
    endTime: '22:00',
    status: EventStatus.PUBLISHED,
    seats: 180,
    banner: img('1604004555489-723a93d6ce74'),
    gallery: [img('1471478331149-c72f17e33c73'), img('1517245386807-bb43f82c33c4')],
    highlights: ['6 world-premiere works', 'Kathak-fusion showcase', 'Masterclass add-on tickets', 'Post-show artist conversations'],
  },
];

// ─── Occupancy seeding ───────────────────────────────────────────────────────
// Spec: 70–85% available ⇒ 15–30% occupied. We target ~18% booked.
export const OCCUPANCY_PCT = 18;

/** Deterministic 32-bit hash from a string (stable across runs). */
export function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// ─── Seat generation with tiered pricing + best-view logic ──────────────────
export interface GeneratedSeat {
  eventId: string;
  seatNumber: string;
  row: string;
  section: string;
  price: number;
  status: 'AVAILABLE' | 'BOOKED';
}

/**
 * Generates a tiered seat map: VIP rows closest to the stage (front rows),
 * then PREMIUM, then GENERAL. Prices come from TIER_MAP with a small
 * deterministic variation (aisle seats cheaper). ~18% of seats are
 * deterministically marked BOOKED so occupancy is realistic and stable
 * across re-runs.
 */
export function generateSeats(eventId: string, seedName: string, count: number, tierKey: string): GeneratedSeat[] {
  const tiers = TIER_MAP[tierKey] || TIER_MAP.comedy;
  const rows = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const seatsPerRow = count <= 200 ? 14 : count <= 350 ? 16 : 20;
  const totalRows = Math.ceil(count / seatsPerRow);

  const vipRows = Math.max(1, Math.round(totalRows * 0.15));
  const premiumRows = Math.max(2, Math.round(totalRows * 0.3));

  const seats: GeneratedSeat[] = [];
  let seatIndex = 0;
  for (let r = 0; r < totalRows && seatIndex < count; r++) {
    const rowChar = rows[r % rows.length];
    const tierIdx = r < vipRows ? 2 : r < vipRows + premiumRows ? 1 : 0; // VIP front
    const tier = tiers[tierIdx];

    for (let s = 1; s <= seatsPerRow && seatIndex < count; s++) {
      const seatNum = `${rowChar}${String(s).padStart(2, '0')}`;
      const aisleAdj = s <= 2 || s > seatsPerRow - 2 ? -100 : 0;
      const jitter = (hashSeed(`${seedName}${seatNum}`) % 5) * 10;
      const preBooked = hashSeed(`${seedName}-booked-${seatNum}`) % 100 < OCCUPANCY_PCT;

      seats.push({
        eventId,
        seatNumber: seatNum,
        row: rowChar,
        section: tier.name,
        price: tier.price + aisleAdj + jitter,
        status: preBooked ? 'BOOKED' : 'AVAILABLE',
      });
      seatIndex++;
    }
  }
  return seats;
}

export const tierKeyByCategory: Record<string, string> = {
  Music: 'music',
  Technology: 'tech',
  Comedy: 'comedy',
  Film: 'film',
  Sports: 'sports',
  Dance: 'dance',
};
