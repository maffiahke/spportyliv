import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { HeroSlide } from '../types/sports';

interface HeroBannerProps {
  slides: HeroSlide[];
  onAction: (matchId: string) => void;
}

/**
 * Image-only hero carousel — the banner artwork is fully designed upstream
 * (headline, players, logos baked into the image), so the app just displays
 * the picture full-bleed and opens the linked event when tapped.
 * Slides without an image are skipped: banners are image-only now.
 */
export const HeroBanner: React.FC<HeroBannerProps> = ({ slides, onAction }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const visible = slides.filter((s) => s.imageUrl?.trim());

  useEffect(() => {
    if (!isPlaying || visible.length === 0) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % visible.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [isPlaying, visible.length]);

  if (visible.length === 0) return null;
  // Keep the index in range even if the slide list shrinks while mounted.
  const safeIndex = ((activeIndex % visible.length) + visible.length) % visible.length;
  const current = visible[safeIndex];
  const altText = [current.headlineTop, current.headlineHighlight, current.headlineBottom]
    .filter(Boolean)
    .join(' ')
    .trim();

  const go = (delta: number) =>
    setActiveIndex((prev) => {
      const next = prev + delta;
      return ((next % visible.length) + visible.length) % visible.length;
    });

  const banner = (
    <img
      key={current.imageUrl}
      src={current.imageUrl!}
      alt={altText || 'Featured live sports'}
      draggable={false}
      className="w-full aspect-[8/3] object-cover"
      onError={(e) => {
        // Broken artwork: drop the slide rather than show an empty frame.
        (e.currentTarget as HTMLImageElement).style.opacity = '0';
      }}
    />
  );

  return (
    <div className="neu-surface rounded-[28px] p-1.5 sm:p-2">
      <section aria-label="Featured live sports" className="relative rounded-[22px] overflow-hidden bg-slate-950">
        {current.matchId ? (
          <button
            type="button"
            onClick={() => onAction(current.matchId!)}
            className="block w-full cursor-pointer"
            aria-label={altText ? `Open ${altText}` : 'Open featured event'}
          >
            {banner}
          </button>
        ) : (
          banner
        )}

        {/* Carousel controls (bottom center, over the artwork) */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-slate-950/45 backdrop-blur-sm px-2 py-1 rounded-full">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous slide"
            className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/35 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPlaying((p) => !p);
            }}
            aria-label={isPlaying ? 'Pause hero carousel' : 'Play hero carousel'}
            className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause className="w-2 h-2 fill-current" /> : <Play className="w-2 h-2 fill-current ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }
            }
            aria-label="Next slide"
            className="w-5 h-5 rounded-full bg-white/15 hover:bg-white/35 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Hero slides">
            {visible.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={idx === safeIndex}
                aria-label={`Slide ${idx + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === safeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
