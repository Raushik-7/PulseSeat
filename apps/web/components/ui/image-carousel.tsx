'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  images: string[];
  alt: string;
  className?: string;
  aspectRatio?: string;
}

export function ImageCarousel({ images, alt, className, aspectRatio = 'aspect-[16/10]' }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const validImages = images.filter((_, i) => !failedImages.has(i));

  if (validImages.length === 0) {
    return (
      <div className={cn(aspectRatio, 'bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center', className)}>
        <span className="text-4xl opacity-10 font-bold select-none">{alt?.charAt(0)}</span>
      </div>
    );
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  const handleImageError = (index: number) => {
    setFailedImages((prev) => new Set(prev).add(index));
  };

  // Recalculate current index if it's out of bounds
  const safeIndex = currentIndex >= validImages.length ? 0 : currentIndex;

  return (
    <div className={cn('relative overflow-hidden group', className)}>
      {/* Image */}
      <div className={cn(aspectRatio, 'relative')}>
        <img
          src={validImages[safeIndex]}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => handleImageError(images.indexOf(validImages[safeIndex]))}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Navigation arrows (only show if more than 1 image) */}
      {validImages.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70 z-10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/70 z-10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {validImages.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {validImages.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentIndex(i); }}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === safeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60',
              )}
            />
          ))}
        </div>
      )}

      {/* Image counter */}
      {validImages.length > 1 && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-[10px] text-white font-medium z-10">
          {safeIndex + 1}/{validImages.length}
        </div>
      )}
    </div>
  );
}
