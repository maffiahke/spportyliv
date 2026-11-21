import React, { useState } from 'react';
import { CrestId, SportCategoryId } from '../types/sports';

export const SportyLiveLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="sl-blue" x1="6" y1="6" x2="36" y2="34" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="55%" stopColor="#1D6BFF" />
        <stop offset="100%" stopColor="#1E40AF" />
      </linearGradient>
      <linearGradient id="sl-orange" x1="8" y1="38" x2="42" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F97316" />
        <stop offset="60%" stopColor="#FB923C" />
        <stop offset="100%" stopColor="#FACC15" />
      </linearGradient>
    </defs>
    {/* Outer rounded play frame */}
    <path
      d="M11 8.8C11 6.4 13.7 5 15.7 6.3L38.8 20.5C40.7 21.7 40.7 24.5 38.8 25.7L15.7 39.9C13.7 41.2 11 39.8 11 37.4V8.8Z"
      fill="url(#sl-blue)"
    />
    {/* Orange dynamic lower swoosh */}
    <path
      d="M11 32.5C15.5 34.5 22.5 32.8 39.4 22.2C40.5 23.4 40.3 25.1 38.8 26L15.7 40.2C13.7 41.5 11 40.1 11 37.7V32.5Z"
      fill="url(#sl-orange)"
    />
    {/* Crisp inner white play triangle */}
    <path
      d="M18.5 16.5C18.5 15.3 19.8 14.6 20.8 15.2L29.6 20.7C30.5 21.3 30.5 22.7 29.6 23.3L20.8 28.8C19.8 29.4 18.5 28.7 18.5 27.5V16.5Z"
      fill="#FFFFFF"
    />
  </svg>
);

export const SportCategoryIcon: React.FC<{
  sport: SportCategoryId | 'more';
  className?: string;
}> = ({ sport, className = 'w-9 h-9' }) => {
  switch (sport) {
    case 'football':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <defs>
            <radialGradient id="soccer-grad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="72%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#94A3B8" />
            </radialGradient>
          </defs>
          <circle cx="24" cy="24" r="19" fill="url(#soccer-grad)" stroke="#CBD5E1" strokeWidth="1" />
          <polygon points="24,16 30.5,20.8 28,28.2 20,28.2 17.5,20.8" fill="#1E293B" />
          <path d="M24 16V9M30.5 20.8L37 18M28 28.2L32.5 34.5M20 28.2L15.5 34.5M17.5 20.8L11 18" stroke="#1E293B" strokeWidth="1.6" strokeLinecap="round" />
          <polygon points="24,5 28,9.2 20,9.2" fill="#1E293B" />
          <polygon points="41.5,17.5 37,18 39,23" fill="#1E293B" />
          <polygon points="6.5,17.5 11,18 9,23" fill="#1E293B" />
          <polygon points="13,39 15.5,34.5 19.5,38" fill="#1E293B" />
          <polygon points="35,39 32.5,34.5 28.5,38" fill="#1E293B" />
        </svg>
      );
    case 'basketball':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <defs>
            <radialGradient id="bball-grad" cx="34%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="65%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#9A3412" />
            </radialGradient>
          </defs>
          <circle cx="24" cy="24" r="19" fill="url(#bball-grad)" />
          <path d="M5.5 24H42.5M24 5V43" stroke="#1E1B18" strokeWidth="1.7" />
          <path d="M11 10.5C16.5 15.5 16.5 32.5 11 37.5" fill="none" stroke="#1E1B18" strokeWidth="1.7" />
          <path d="M37 10.5C31.5 15.5 31.5 32.5 37 37.5" fill="none" stroke="#1E1B18" strokeWidth="1.7" />
        </svg>
      );
    case 'tennis':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <defs>
            <radialGradient id="tennis-grad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#D9F99D" />
              <stop offset="60%" stopColor="#A3E635" />
              <stop offset="100%" stopColor="#65A30D" />
            </radialGradient>
          </defs>
          <circle cx="24" cy="24" r="19" fill="url(#tennis-grad)" />
          <path d="M11.5 9.8C18.5 17 18.5 31 11.5 38.2" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M36.5 9.8C29.5 17 29.5 31 36.5 38.2" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'boxing':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          {/* Left glove */}
          <g transform="rotate(-14 18 24)">
            <rect x="8" y="13" width="16" height="19" rx="7" fill="#DC2626" />
            <rect x="20" y="19" width="6" height="9" rx="3" fill="#B91C1C" />
            <rect x="10" y="30" width="12" height="6" rx="2" fill="#1E293B" />
            <path d="M11 18C11 16 13 15 15 15" stroke="#FCA5A5" strokeWidth="1.8" strokeLinecap="round" />
          </g>
          {/* Right glove */}
          <g transform="rotate(14 30 24)">
            <rect x="24" y="13" width="16" height="19" rx="7" fill="#EF4444" />
            <rect x="22" y="19" width="6" height="9" rx="3" fill="#B91C1C" />
            <rect x="26" y="30" width="12" height="6" rx="2" fill="#1E293B" />
            <path d="M37 18C37 16 35 15 33 15" stroke="#FCA5A5" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </svg>
      );
    case 'f1':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <path d="M12 40L18 11" stroke="#334155" strokeWidth="2.6" strokeLinecap="round" />
          <g transform="rotate(11 26 20)">
            <path
              d="M17 10C22 8 26 12 31 10C35 8.5 38 10 40 11L37.5 27C35 26 32 24.5 28.5 26C24 27.8 20 24.5 15 26L17 10Z"
              fill="#FFFFFF"
              stroke="#0F172A"
              strokeWidth="1.3"
            />
            <rect x="17.5" y="10.5" width="5" height="5" fill="#0F172A" />
            <rect x="27.5" y="10.5" width="5" height="5" fill="#0F172A" />
            <rect x="22.5" y="15.5" width="5" height="5" fill="#0F172A" />
            <rect x="32.5" y="15.5" width="5" height="5" fill="#0F172A" />
            <rect x="16.5" y="20.5" width="5" height="5" fill="#0F172A" />
            <rect x="26.5" y="20.5" width="5" height="5" fill="#0F172A" />
          </g>
        </svg>
      );
    case 'more':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="3.5" fill="#1D6BFF" />
          <rect x="26" y="9" width="13" height="13" rx="3.5" fill="#1D6BFF" />
          <rect x="9" y="26" width="13" height="13" rx="3.5" fill="#1D6BFF" />
          <rect x="26" y="26" width="13" height="13" rx="3.5" fill="#1D6BFF" />
        </svg>
      );
    case 'cricket':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <circle cx="24" cy="24" r="16" fill="#B91C1C" />
          <path d="M13 13C19 20 29 28 35 35" stroke="#FEF2F2" strokeWidth="2" strokeDasharray="3 2" />
        </svg>
      );
    case 'mma':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <polygon points="24,6 40,15 40,33 24,42 8,33 8,15" fill="#0F172A" stroke="#EF4444" strokeWidth="2.5" />
          <text x="24" y="28" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800">MMA</text>
        </svg>
      );
    case 'golf':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <circle cx="24" cy="24" r="16" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
          <circle cx="19" cy="20" r="1.3" fill="#94A3B8" />
          <circle cx="25" cy="18" r="1.3" fill="#94A3B8" />
          <circle cx="29" cy="23" r="1.3" fill="#94A3B8" />
          <circle cx="22" cy="26" r="1.3" fill="#94A3B8" />
          <circle cx="27" cy="29" r="1.3" fill="#94A3B8" />
        </svg>
      );
    case 'other':
      return (
        <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
          <circle cx="24" cy="24" r="16" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
          <text x="24" y="29" textAnchor="middle" fill="#475569" fontSize="12" fontWeight="800">
            +
          </text>
        </svg>
      );
    default:
      return null;
  }
};

export const TeamCrest: React.FC<{ crest: string; className?: string }> = ({
  crest,
  className = 'w-12 h-12',
}) => {
  // Logo URLs (admin events) render as images instead of built-in SVG crests.
  // A broken URL (404, dead CDN, blocked hotlink) falls back to the generic
  // monogram badge below instead of leaving an invisible hole.
  const [imgFailed, setImgFailed] = useState(false);
  const isUrl = /^(https?:\/\/|data:image\/)/i.test(crest);
  if (isUrl && !imgFailed) {
    return (
      <img
        src={crest}
        alt="Team logo"
        loading="lazy"
        className={`${className} object-contain`}
        onError={() => setImgFailed(true)}
      />
    );
  }
  switch (crest) {
    case 'real-madrid':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Real Madrid crest">
          {/* Crown */}
          <path d="M22 15L25 8L32 11L39 8L42 15H22Z" fill="#FACC15" stroke="#B45309" strokeWidth="1.2" />
          <path d="M32 4V8M30 6H34" stroke="#FACC15" strokeWidth="1.6" strokeLinecap="round" />
          <rect x="21" y="14.5" width="22" height="3.5" rx="1.5" fill="#DC2626" stroke="#B45309" strokeWidth="0.8" />
          {/* Main circle */}
          <circle cx="32" cy="38" r="20" fill="#FFFFFF" stroke="#EAB308" strokeWidth="3.5" />
          <circle cx="32" cy="38" r="16.5" fill="#F8FAFC" stroke="#1D4ED8" strokeWidth="1" />
          {/* Diagonal blue sash */}
          <path d="M18 28L41 51L46 46L23 23Z" fill="#2563EB" />
          {/* Gold monogram */}
          <text
            x="32"
            y="43"
            textAnchor="middle"
            fill="#CA8A04"
            fontSize="14"
            fontWeight="800"
            fontFamily="serif"
          >
            MCF
          </text>
        </svg>
      );
    case 'barcelona':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Barcelona crest">
          <path
            d="M12 14C12 10 20 8 32 8C44 8 52 10 52 14V31C52 45 41 54 32 58C23 54 12 45 12 31V14Z"
            fill="#FACC15"
            stroke="#92400E"
            strokeWidth="2"
          />
          {/* Top Left: St George Cross */}
          <rect x="15" y="12" width="16.5" height="17" fill="#FFFFFF" />
          <path d="M23.25 12V29M15 20.5H31.5" stroke="#DC2626" strokeWidth="3.8" />
          {/* Top Right: Catalan Stripes */}
          <rect x="32.5" y="12" width="16.5" height="17" fill="#FACC15" />
          <path d="M35 12V29M40 12V29M45 12V29" stroke="#DC2626" strokeWidth="2.5" />
          {/* Center Band */}
          <rect x="15" y="29" width="34" height="6" fill="#F59E0B" />
          <text x="32" y="34" textAnchor="middle" fill="#1E293B" fontSize="5.5" fontWeight="900">
            FCB
          </text>
          {/* Bottom Blaugrana */}
          <path d="M15 35H49V37C49 46 40 52 32 55C24 52 15 46 15 37V35Z" fill="#1D4ED8" />
          <path d="M22 35V50M32 35V55M42 35V50" stroke="#B91C1C" strokeWidth="4.2" />
          <circle cx="32" cy="44" r="5" fill="#FDE047" stroke="#92400E" strokeWidth="1" />
        </svg>
      );
    case 'man-utd':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Man Utd crest">
          <circle cx="32" cy="32" r="27" fill="#DA291C" stroke="#FBE122" strokeWidth="3" />
          <circle cx="32" cy="32" r="20" fill="#FBE122" stroke="#1E293B" strokeWidth="1.5" />
          <path d="M20 26H44L40 46L32 50L24 46L20 26Z" fill="#DA291C" stroke="#1E293B" strokeWidth="1.5" />
          <path d="M25 22L32 16L39 22H25Z" fill="#1E293B" />
          <circle cx="32" cy="37" r="5" fill="#FBE122" />
        </svg>
      );
    case 'chelsea':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Chelsea crest">
          <circle cx="32" cy="32" r="27" fill="#034694" stroke="#FFFFFF" strokeWidth="2.5" />
          <circle cx="32" cy="32" r="21" fill="none" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="32" cy="32" r="14" fill="#FFFFFF" />
          <path d="M28 24C32 22 37 25 36 31C35 36 31 39 27 40L29 33L25 30L28 24Z" fill="#034694" />
        </svg>
      );
    case 'arsenal':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Arsenal crest">
          <path
            d="M12 12H52V33C52 46 39 54 32 57C25 54 12 46 12 33V12Z"
            fill="#EF0107"
            stroke="#9C824A"
            strokeWidth="3.5"
          />
          <path d="M12 12H24V46C17 42 12 36 12 30V12Z" fill="#063672" opacity="0.25" />
          <rect x="20" y="30" width="24" height="6" rx="3" fill="#DBAC34" />
          <circle cx="28" cy="38" r="5" fill="none" stroke="#DBAC34" strokeWidth="2.5" />
          <text x="32" y="24" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900">
            ARS
          </text>
        </svg>
      );
    case 'tottenham':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Tottenham crest">
          <circle cx="32" cy="46" r="9" fill="#FFFFFF" stroke="#132257" strokeWidth="2.5" />
          <path
            d="M32 37V22C32 16 36 12 39 14C41 15 39 19 36 20L38 25C40 28 38 33 34 35L32 37Z"
            fill="#132257"
          />
          <circle cx="36" cy="15" r="3" fill="#132257" />
        </svg>
      );
    case 'laliga':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-label="LaLiga logo">
          <circle cx="20" cy="20" r="18" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
          <path d="M20 7L31 13.5V26.5L20 33L9 26.5V13.5L20 7Z" fill="none" stroke="#FF4B44" strokeWidth="3" />
          <circle cx="20" cy="12" r="2.5" fill="#FACC15" />
          <circle cx="27" cy="16" r="2.5" fill="#3B82F6" />
          <circle cx="27" cy="24" r="2.5" fill="#10B981" />
          <circle cx="20" cy="28" r="2.5" fill="#EC4899" />
          <circle cx="13" cy="24" r="2.5" fill="#F97316" />
          <circle cx="13" cy="16" r="2.5" fill="#8B5CF6" />
        </svg>
      );
    case 'premier-league':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-label="Premier League logo">
          <circle cx="20" cy="20" r="17" fill="#38003C" />
          <path d="M13 15L16 11L20 13.5L24 11L27 15L25 27H15L13 15Z" fill="#FFFFFF" />
          <circle cx="20" cy="21" r="3" fill="#38003C" />
        </svg>
      );
    case 'lakers':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Lakers crest">
          <circle cx="32" cy="32" r="26" fill="#552583" stroke="#FDB927" strokeWidth="3.5" />
          <text x="32" y="36" textAnchor="middle" fill="#FDB927" fontSize="13" fontWeight="900">
            LAL
          </text>
        </svg>
      );
    case 'celtics':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Celtics crest">
          <circle cx="32" cy="32" r="26" fill="#007A33" stroke="#FFFFFF" strokeWidth="3.5" />
          <text x="32" y="36" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900">
            BOS
          </text>
        </svg>
      );
    case 'nba':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-label="NBA logo">
          <rect x="7" y="4" width="26" height="32" rx="6" fill="#1D428A" />
          <rect x="20" y="4" width="13" height="32" rx="4" fill="#C8102E" />
          <circle cx="20" cy="14" r="3.5" fill="#FFFFFF" />
          <path d="M17 19H23L21 31H17L17 19Z" fill="#FFFFFF" />
        </svg>
      );
    case 'alcaraz':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Alcaraz badge">
          <circle cx="32" cy="32" r="26" fill="#B91C1C" stroke="#FACC15" strokeWidth="3.5" />
          <text x="32" y="37" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="900">
            CA
          </text>
        </svg>
      );
    case 'sinner':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Sinner badge">
          <circle cx="32" cy="32" r="26" fill="#1D4ED8" stroke="#FFFFFF" strokeWidth="3.5" />
          <text x="32" y="37" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="900">
            JS
          </text>
        </svg>
      );
    case 'atp':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-label="ATP logo">
          <circle cx="20" cy="20" r="17" fill="#0F172A" />
          <text x="20" y="24" textAnchor="middle" fill="#A3E635" fontSize="11" fontWeight="900">
            ATP
          </text>
        </svg>
      );
    case 'fury':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Fury badge">
          <circle cx="32" cy="32" r="26" fill="#991B1B" stroke="#FDE047" strokeWidth="3" />
          <text x="32" y="37" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="900">
            TF
          </text>
        </svg>
      );
    case 'usyk':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Usyk badge">
          <circle cx="32" cy="32" r="26" fill="#1E3A8A" stroke="#FACC15" strokeWidth="3" />
          <text x="32" y="37" textAnchor="middle" fill="#FACC15" fontSize="14" fontWeight="900">
            OU
          </text>
        </svg>
      );
    case 'boxing-belt':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-label="Boxing championship">
          <circle cx="20" cy="20" r="17" fill="#B45309" />
          <circle cx="20" cy="20" r="9" fill="#FACC15" />
        </svg>
      );
    case 'f1-redbull':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Red Bull Racing">
          <circle cx="32" cy="32" r="26" fill="#1E1B4B" stroke="#EF4444" strokeWidth="3.5" />
          <text x="32" y="37" textAnchor="middle" fill="#FACC15" fontSize="14" fontWeight="900">
            RBR
          </text>
        </svg>
      );
    case 'f1-ferrari':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Ferrari Racing">
          <circle cx="32" cy="32" r="26" fill="#DC2626" stroke="#FACC15" strokeWidth="3.5" />
          <text x="32" y="37" textAnchor="middle" fill="#FEF08A" fontSize="14" fontWeight="900">
            FER
          </text>
        </svg>
      );
    case 'f1-league':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-label="Formula 1 logo">
          <rect x="4" y="10" width="32" height="20" rx="5" fill="#DC2626" />
          <text x="20" y="24" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="900" fontStyle="italic">
            F1
          </text>
        </svg>
      );
    case 'bayern':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Bayern crest">
          <circle cx="32" cy="32" r="26" fill="#DC052D" stroke="#FFFFFF" strokeWidth="3" />
          <circle cx="32" cy="32" r="15" fill="#0066B2" stroke="#FFFFFF" strokeWidth="2" />
          <text x="32" y="36" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900">
            FCB
          </text>
        </svg>
      );
    case 'dortmund':
      return (
        <svg viewBox="0 0 64 64" className={className} aria-label="Dortmund crest">
          <circle cx="32" cy="32" r="26" fill="#FDE100" stroke="#111827" strokeWidth="3.5" />
          <text x="32" y="37" textAnchor="middle" fill="#111827" fontSize="13" fontWeight="900">
            BVB
          </text>
        </svg>
      );
    case 'bundesliga':
      return (
        <svg viewBox="0 0 40 40" className={className} aria-label="Bundesliga logo">
          <rect x="5" y="5" width="30" height="30" rx="6" fill="#D20515" />
          <text x="20" y="24" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900">
            BL
          </text>
        </svg>
      );
  }
  // Unknown / dynamic crest (IPTV-imported teams): generic monogram disc.
  // A failed logo URL falls back here too — derive the label from the last
  // URL path segment (e.g. .../teamlogos/afg.png → “AFG”).
  const source = isUrl
    ? crest.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? ''
    : crest;
  const monogram = (source || '?')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
  let hash = 0;
  for (let i = 0; i < crest.length; i++) hash = (hash * 31 + crest.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-label={`${monogram} badge`}>
      <circle cx="32" cy="32" r="26" fill={`hsl(${hue} 70% 42%)`} stroke="#FFFFFF" strokeWidth="3" />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="16"
        fontWeight="900"
        fontFamily="inherit"
      >
        {monogram || '?'}
      </text>
    </svg>
  );
};
