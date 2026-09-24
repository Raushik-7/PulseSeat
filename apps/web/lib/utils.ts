import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const categoryColorMap: Record<string, string> = {
  music: 'cat-music',
  technology: 'cat-technology',
  comedy: 'cat-comedy',
  film: 'cat-film',
  sports: 'cat-sports',
  dance: 'cat-dance',
};

export function categoryColor(category: string): string {
  return categoryColorMap[category.toLowerCase()] || 'cat-default';
}

const categoryEmojiMap: Record<string, string> = {
  music: '🎵',
  technology: '💻',
  comedy: '😂',
  film: '🎬',
  sports: '⚽',
  dance: '💃',
};

export function categoryEmoji(category: string): string {
  return categoryEmojiMap[category.toLowerCase()] || '🎉';
}

// Event images by category (Unsplash URLs for realistic images)
const eventImages: Record<string, string[]> = {
  music: [
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&h=500&fit=crop',
  ],
  technology: [
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=500&fit=crop',
  ],
  comedy: [
    'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1595262201690-a38a9f5e89ee?w=800&h=500&fit=crop',
  ],
  film: [
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&h=500&fit=crop',
  ],
  sports: [
    'https://images.unsplash.com/photo-1461896836934-bd45ba8d9af8?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=500&fit=crop',
  ],
  dance: [
    'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1547153760-18fc86c1f41d?w=800&h=500&fit=crop',
    'https://images.unsplash.com/photo-1535525153412-5a42439a210d?w=800&h=500&fit=crop',
  ],
};

export function getEventImage(category: string, index = 0): string {
  const cat = category.toLowerCase();
  const images = eventImages[cat] || eventImages.music;
  return images[index % images.length];
}

// Get an image index based on event name for consistent but varied images
export function getEventImageIndex(eventName: string): number {
  let hash = 0;
  for (let i = 0; i < eventName.length; i++) {
    hash = ((hash << 5) - hash) + eventName.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Get 3 images for an event (carousel)
export function getEventImages(category: string, eventName: string): string[] {
  const baseIndex = getEventImageIndex(eventName);
  return [
    getEventImage(category, baseIndex),
    getEventImage(category, baseIndex + 1),
    getEventImage(category, baseIndex + 2),
  ];
}
