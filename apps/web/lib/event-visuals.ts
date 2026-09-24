// Centralized event visuals — images live in the database (bannerUrl / galleryUrls);
// these helpers provide graceful fallbacks if a URL is missing or fails to load.

const fallbackImages: Record<string, string[]> = {
  Music: [
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&h=500&fit=crop&auto=format',
  ],
  Technology: [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&h=500&fit=crop&auto=format',
  ],
  Comedy: [
    'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&h=500&fit=crop&auto=format',
  ],
  Film: [
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&h=500&fit=crop&auto=format',
  ],
  Sports: [
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=500&fit=crop&auto=format',
  ],
  Dance: [
    'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=800&h=500&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1535525153412-5a42439a210d?w=800&h=500&fit=crop&auto=format',
  ],
};

interface EventLike {
  category?: string;
  bannerUrl?: string | null;
  galleryUrls?: string[] | null;
}

/** Cover image for cards/hero — DB first, category fallback second. */
export function eventCover(event: EventLike): string {
  if (event.bannerUrl) return event.bannerUrl;
  return fallbackImages[event.category || 'Music']?.[0] || fallbackImages.Music[0];
}

/** All display images for carousels/gallery — unique by construction. */
export function eventGallery(event: EventLike): string[] {
  const fromDb = (event.galleryUrls || []).filter(Boolean);
  const all = [event.bannerUrl, ...fromDb].filter(Boolean) as string[];
  const unique = Array.from(new Set(all));
  if (unique.length >= 3) return unique.slice(0, 3);

  const fallbacks = (fallbackImages[event.category || 'Music'] || fallbackImages.Music).filter(
    (u) => !unique.includes(u),
  );
  return [...unique, ...fallbacks].slice(0, 3);
}

/** Accessible alt text for event imagery. */
export function eventAlt(event: EventLike, index = 0): string {
  const cat = event.category || 'Event';
  const suffix = index === 0 ? 'cover image' : `gallery photo ${index + 1}`;
  return `${cat} event ${suffix}`;
}
