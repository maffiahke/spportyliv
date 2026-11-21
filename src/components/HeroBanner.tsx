import React, { useEffect, useState } from 'react';
import { ChevronRight, Pause, Play } from 'lucide-react';
import { HeroSlide } from '../types/sports';

interface HeroBannerProps {
  slides: HeroSlide[];
  onAction: (matchId: string) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ slides, onAction }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [isPlaying, slides.length]);

  const current = slides[activeIndex];

  return (
    <div className="neu-surface rounded-[28px] p-1.5 sm:p-2">
      <section
        aria-label="Featured live sports"
        className="relative rounded-[22px] overflow-hidden shadow-inner select-none"
        style={{ background: current.bgGradient }}
      >
      {/* Optional admin-supplied photo hero (gradient acts as a scrim) */}
      {current.imageUrl && (
        <>
          <img
            key={current.imageUrl}
            src={current.imageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(100deg, rgba(6,15,40,0.9) 0%, rgba(6,15,40,0.62) 48%, rgba(6,15,40,0.24) 100%)',
            }}
          />
        </>
      )}

      {/* Stadium floodlight atmosphere & green turf glow */}
      <div
        className={`absolute inset-0 pointer-events-none overflow-hidden transition-opacity ${
          current.imageUrl ? 'opacity-25' : 'opacity-100'
        }`}
      >
        {/* Floodlight cones */}
        <div
          className="absolute -top-12 right-12 w-56 h-56 rounded-full opacity-40 blur-2xl"
          style={{ background: 'radial-gradient(circle, #93C5FD 0%, transparent 70%)' }}
        />
        <div
          className="absolute -top-10 left-1/3 w-48 h-48 rounded-full opacity-35 blur-2xl"
          style={{ background: 'radial-gradient(circle, #60A5FA 0%, transparent 70%)' }}
        />
        {/* Subtle stadium roof / bowl lines */}
        <svg
          viewBox="0 0 600 260"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full opacity-25"
        >
          <path d="M160 0 C260 65, 440 65, 600 10" stroke="#93C5FD" strokeWidth="1.5" fill="none" />
          <path d="M180 28 C280 85, 450 85, 600 38" stroke="#60A5FA" strokeWidth="1" fill="none" />
          {/* Floodlight spots */}
          <circle cx="315" cy="18" r="3" fill="#FFFFFF" />
          <circle cx="325" cy="18" r="3" fill="#FFFFFF" />
          <circle cx="335" cy="18" r="3" fill="#FFFFFF" />
          <circle cx="515" cy="14" r="3" fill="#FFFFFF" />
          <circle cx="525" cy="14" r="3" fill="#FFFFFF" />
          <circle cx="535" cy="14" r="3" fill="#FFFFFF" />
        </svg>
        {/* Pitch turf arc at bottom right */}
        <div
          className="absolute -bottom-8 -right-6 w-3/4 h-16 rounded-t-full opacity-45 blur-sm"
          style={{ background: 'linear-gradient(90deg, transparent 0%, #16A34A 45%, #22C55E 100%)' }}
        />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 flex items-center justify-between min-h-[134px] sm:min-h-[150px] lg:min-h-[166px] px-4 pt-3.5 pb-7 sm:px-6 sm:pt-4 sm:pb-8">
        {/* Left Copy + CTA */}
        <div className="max-w-[64%] sm:max-w-[60%] z-20">
          <h1 className="font-display font-extrabold italic leading-[1.08] tracking-tight text-[19px] sm:text-[24px] lg:text-[28px] text-white drop-shadow-sm text-balance">
            <span>{current.headlineTop} </span>
            <span className="text-[#FACC15]">{current.headlineHighlight} </span>
            <span className="block">{current.headlineBottom}</span>
          </h1>

          <p className="mt-1 text-[10.5px] sm:text-xs font-medium text-blue-50/90 leading-snug truncate">
            {current.subtitleLine1} · {current.subtitleLine2}
          </p>

          {current.matchId && (
            <button
              type="button"
              onClick={() => onAction(current.matchId!)}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#FACC15] hover:bg-[#FDE047] active:scale-[0.98] transition-all px-3.5 py-1.5 min-h-[34px] text-slate-950 font-display font-extrabold text-xs sm:text-[13px] shadow-[0_4px_14px_rgba(250,204,21,0.38)] cursor-pointer whitespace-nowrap"
            >
            <span className="w-4 h-4 rounded-full bg-slate-950 text-[#FACC15] flex items-center justify-center">
              <Play className="w-2 h-2 fill-current ml-0.5" />
            </span>
            <span>{current.ctaLabel}</span>
            <ChevronRight className="w-3.5 h-3.5 -ml-0.5 stroke-[2.6]" />
            </button>
          )}
        </div>

        {/* Right Athletic Trio Artwork (hidden when a photo hero is set) */}
        {!current.imageUrl && (
          <div className="absolute right-1 bottom-0 top-2 w-[38%] sm:w-[36%] pointer-events-none flex items-end justify-end overflow-hidden">
            <HeroAthleticVisual sport={current.sport} />
          </div>
        )}
      </div>

      {/* Bottom Center Carousel Controls */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-slate-950/35 backdrop-blur-sm px-2 py-0.5 rounded-full">
        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          aria-label={isPlaying ? 'Pause hero carousel' : 'Play hero carousel'}
          className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center text-white transition-colors cursor-pointer"
        >
          {isPlaying ? (
            <Pause className="w-2 h-2 fill-current" />
          ) : (
            <Play className="w-2 h-2 fill-current ml-0.5" />
          )}
        </button>

        <div className="flex items-center gap-1.5" role="tablist" aria-label="Hero slides">
          {slides.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={idx === activeIndex}
              aria-label={`Slide ${idx + 1}: ${slide.headlineHighlight}`}
              onClick={() => setActiveIndex(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      </div>
      </section>
    </div>
  );
};

const HeroAthleticVisual: React.FC<{ sport: HeroSlide['sport'] }> = ({ sport }) => {
  if (sport === 'basketball') {
    return (
      <svg viewBox="0 0 260 220" className="h-full w-auto max-w-none" aria-hidden="true">
        <defs>
          <radialGradient id="bball-glow" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#FACC15" stopOpacity="0.4" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle cx="150" cy="100" r="85" fill="url(#bball-glow)" />
        {/* Basketball hoop & backboard */}
        <rect x="168" y="25" width="70" height="46" rx="4" fill="rgba(255,255,255,0.14)" stroke="#FFFFFF" strokeWidth="2.5" />
        <rect x="188" y="42" width="30" height="20" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <ellipse cx="203" cy="68" rx="16" ry="4" fill="none" stroke="#F97316" strokeWidth="3.5" />
        {/* Player silhouette */}
        <circle cx="115" cy="70" r="17" fill="#1E1B4B" stroke="#FACC15" strokeWidth="2" />
        <path d="M84 120C90 92 135 88 148 118L158 178H82L84 120Z" fill="#552583" stroke="#FDB927" strokeWidth="2.5" />
        <text x="118" y="148" textAnchor="middle" fill="#FDB927" fontSize="28" fontWeight="900">23</text>
        {/* Basketball */}
        <circle cx="158" cy="64" r="18" fill="#EA580C" stroke="#1E1B18" strokeWidth="2" />
        <path d="M141 64H175M158 47V81" stroke="#1E1B18" strokeWidth="1.5" />
      </svg>
    );
  }

  if (sport === 'tennis') {
    return (
      <svg viewBox="0 0 260 220" className="h-full w-auto max-w-none" aria-hidden="true">
        <circle cx="155" cy="95" r="78" fill="rgba(163,230,53,0.18)" />
        {/* Tennis racket */}
        <g transform="rotate(-24 165 95)">
          <ellipse cx="165" cy="72" rx="32" ry="42" fill="rgba(255,255,255,0.08)" stroke="#E2E8F0" strokeWidth="5" />
          <path d="M142 52H188M136 66H194M136 80H194M144 94H186M153 34V110M165 30V114M177 34V110" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
          <rect x="160" y="114" width="10" height="58" rx="4" fill="#0F172A" />
        </g>
        {/* Flying tennis ball */}
        <circle cx="88" cy="84" r="22" fill="#A3E635" stroke="#65A30D" strokeWidth="2" />
        <path d="M75 68C83 77 83 91 75 100M101 68C93 77 93 91 101 100" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
      </svg>
    );
  }

  if (sport === 'boxing') {
    return (
      <svg viewBox="0 0 260 220" className="h-full w-auto max-w-none" aria-hidden="true">
        <circle cx="145" cy="110" r="82" fill="rgba(239,68,68,0.22)" />
        {/* Boxing ring ropes */}
        <path d="M40 160H260M40 185H260" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
        {/* Large heroic boxing gloves */}
        <g transform="rotate(-18 115 115)">
          <rect x="68" y="65" width="64" height="76" rx="28" fill="#DC2626" stroke="#FCA5A5" strokeWidth="2" />
          <rect x="76" y="135" width="48" height="22" rx="6" fill="#0F172A" />
        </g>
        <g transform="rotate(16 175 115)">
          <rect x="135" y="65" width="64" height="76" rx="28" fill="#EF4444" stroke="#FCA5A5" strokeWidth="2" />
          <rect x="143" y="135" width="48" height="22" rx="6" fill="#0F172A" />
        </g>
      </svg>
    );
  }

  if (sport === 'f1') {
    return (
      <svg viewBox="0 0 260 220" className="h-full w-auto max-w-none" aria-hidden="true">
        {/* Speed streaks */}
        <path d="M30 85H230M10 115H245M55 145H240" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Formula 1 race car profile */}
        <g transform="translate(36, 98)">
          <path d="M22 44L52 24H125L158 10H185L195 32L210 42V54H20L22 44Z" fill="#DC2626" />
          <path d="M88 24L115 14H142L126 24H88Z" fill="#0F172A" />
          <rect x="176" y="12" width="12" height="24" fill="#1E293B" />
          <rect x="10" y="48" width="38" height="8" rx="3" fill="#FFFFFF" />
          <circle cx="58" cy="54" r="19" fill="#0F172A" stroke="#475569" strokeWidth="3" />
          <circle cx="58" cy="54" r="8" fill="#EF4444" />
          <circle cx="174" cy="54" r="21" fill="#0F172A" stroke="#475569" strokeWidth="3" />
          <circle cx="174" cy="54" r="9" fill="#EF4444" />
        </g>
      </svg>
    );
  }

  // Default Football 3-superstar composition matching screenshot
  return (
    <svg viewBox="0 0 270 225" className="h-full w-auto max-w-none" aria-hidden="true">
      <defs>
        <linearGradient id="arg-kit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#BAE6FD" />
        </linearGradient>
        <linearGradient id="fra-kit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="por-kit" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#166534" />
        </linearGradient>
        <radialGradient id="rim-glow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.45" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      <circle cx="145" cy="95" r="95" fill="url(#rim-glow)" />

      {/* Right player (#7 Red/Green) */}
      <g transform="translate(178, 22)">
        <ellipse cx="44" cy="30" rx="14" ry="17" fill="#D99B72" />
        <path d="M31 24C31 12 56 11 58 24C53 19 37 19 31 24Z" fill="#1E1B18" />
        <path d="M18 68C22 50 64 50 72 68L82 185H10L18 68Z" fill="url(#por-kit)" />
        <path d="M18 68L52 185H10L18 68Z" fill="#B91C1C" opacity="0.85" />
        <circle cx="56" cy="86" r="5" fill="#FACC15" opacity="0.9" />
        <text x="58" y="138" fill="#FFFFFF" fontSize="20" fontWeight="900" opacity="0.95">7</text>
      </g>

      {/* Left player (#10 Sky/White stripes) */}
      <g transform="translate(26, 26)">
        <ellipse cx="46" cy="30" rx="14.5" ry="17.5" fill="#E6B08A" />
        <path d="M32 23C33 11 59 11 60 24C53 18 39 18 32 23Z" fill="#3B2314" />
        <path d="M35 37C39 47 53 47 57 37C55 43 37 43 35 37Z" fill="#4A2E1B" />
        <path d="M14 70C20 50 72 50 80 70L88 188H8L14 70Z" fill="url(#arg-kit)" />
        {/* Sky blue vertical stripes */}
        <rect x="24" y="56" width="11" height="132" fill="#60A5FA" opacity="0.75" />
        <rect x="44" y="55" width="11" height="133" fill="#60A5FA" opacity="0.75" />
        <rect x="64" y="58" width="10" height="130" fill="#60A5FA" opacity="0.75" />
        <text x="48" y="142" textAnchor="middle" fill="#0F172A" fontSize="24" fontWeight="900">10</text>
      </g>

      {/* Center hero player (#10 Navy/Gold) */}
      <g transform="translate(96, 8)">
        <ellipse cx="52" cy="32" rx="15.5" ry="18.5" fill="#9A613E" />
        <path d="M37 22C39 11 64 11 67 23C59 17 44 17 37 22Z" fill="#111827" />
        {/* Smile highlight */}
        <path d="M46 38Q52 43 58 38" stroke="#FFFFFF" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M16 74C24 52 80 52 88 74L98 205H6L16 74Z" fill="url(#fra-kit)" stroke="#3B82F6" strokeWidth="1.2" />
        {/* Gold crest & #10 */}
        <circle cx="70" cy="96" r="6" fill="#FACC15" />
        <path d="M48 64L52 72L56 64" stroke="#EF4444" strokeWidth="2" fill="none" />
        <text x="52" y="152" textAnchor="middle" fill="#FACC15" fontSize="34" fontWeight="900">10</text>
      </g>
    </svg>
  );
};
