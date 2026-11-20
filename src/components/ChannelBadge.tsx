import React from 'react';
import { TVChannel } from '../types/sports';

export const ChannelBadge: React.FC<{
  variant: TVChannel['logoVariant'];
  name?: string;
}> = ({
  variant,
  name,
}) => {
  switch (variant) {
    case 'willow':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <text
            x="40"
            y="43"
            textAnchor="middle"
            fill="#0F172A"
            fontSize="13.5"
            fontWeight="800"
            letterSpacing="-0.5"
            fontFamily="sans-serif"
          >
            WILLOW
          </text>
          <circle cx="52" cy="38.5" r="5" fill="#B91C1C" />
          <path d="M49 35.5C51 37.5 53 39.5 55 41.5" stroke="#FFFFFF" strokeWidth="0.9" strokeDasharray="1.5 1" />
        </svg>
      );
    case 'willow-xtra':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <text
            x="27"
            y="43"
            textAnchor="middle"
            fill="#0F172A"
            fontSize="9.5"
            fontWeight="800"
            fontFamily="sans-serif"
          >
            WILLOW
          </text>
          <circle cx="48" cy="39.5" r="3.2" fill="#B91C1C" />
          <text
            x="61"
            y="43"
            textAnchor="middle"
            fill="#DC2626"
            fontSize="9"
            fontWeight="900"
            fontStyle="italic"
            fontFamily="sans-serif"
          >
            XTRA
          </text>
        </svg>
      );
    case 'tnt':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="tnt-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" r="34" fill="url(#tnt-g)" />
          <text
            x="40"
            y="42"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="18"
            fontWeight="900"
            fontStyle="italic"
          >
            TNT
          </text>
          <text
            x="40"
            y="54"
            textAnchor="middle"
            fill="#FCE7F3"
            fontSize="7.5"
            fontWeight="800"
            letterSpacing="1.2"
          >
            SPORTS
          </text>
        </svg>
      );
    case 'sky-pl':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <rect x="8" y="25" width="30" height="22" rx="4" fill="#1D4ED8" />
          <text x="23" y="40" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900">
            sky
          </text>
          <rect x="38" y="25" width="34" height="22" rx="4" fill="#DC2626" />
          <text x="55" y="39" textAnchor="middle" fill="#FFFFFF" fontSize="8.5" fontWeight="900">
            sports
          </text>
          <text x="40" y="59" textAnchor="middle" fill="#38003C" fontSize="7.5" fontWeight="800">
            PREMIER LEAGUE
          </text>
        </svg>
      );
    case 'bein':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <rect x="10" y="22" width="60" height="26" rx="7" fill="#5B21B6" />
          <text x="40" y="40" textAnchor="middle" fill="#FFFFFF" fontSize="16" fontWeight="900">
            beIN
          </text>
          <text x="40" y="59" textAnchor="middle" fill="#5B21B6" fontSize="8" fontWeight="800" letterSpacing="1">
            SPORTS 1
          </text>
        </svg>
      );
    case 'star-1':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <polygon
            points="30,15 34,27 47,27 36.5,35 40.5,47 30,39.5 19.5,47 23.5,35 13,27 26,27"
            fill="#FFFFFF"
            stroke="#1D4ED8"
            strokeWidth="2.5"
          />
          <polygon points="30,22 33,31 24,31" fill="#F97316" />
          <text x="52" y="41" textAnchor="middle" fill="#1E3A8A" fontSize="22" fontWeight="900" fontStyle="italic">
            1
          </text>
          <text x="64" y="36" textAnchor="middle" fill="#1D4ED8" fontSize="7" fontWeight="900">
            HD
          </text>
          <text x="40" y="61" textAnchor="middle" fill="#1E293B" fontSize="7.5" fontWeight="900" letterSpacing="0.5">
            STAR SPORTS
          </text>
        </svg>
      );
    case 'star-hindi':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <polygon
            points="30,14 34,26 47,26 36.5,34 40.5,46 30,38.5 19.5,46 23.5,34 13,26 26,26"
            fill="#FFFFFF"
            stroke="#0284C7"
            strokeWidth="2.5"
          />
          <polygon points="30,21 33,30 24,30" fill="#EA580C" />
          <text x="54" y="40" textAnchor="middle" fill="#0F172A" fontSize="22" fontWeight="900" fontStyle="italic">
            1
          </text>
          <text x="40" y="58" textAnchor="middle" fill="#1E293B" fontSize="7" fontWeight="900">
            STAR SPORTS
          </text>
          <text x="40" y="67" textAnchor="middle" fill="#0284C7" fontSize="7" fontWeight="800">
            हिन्दी
          </text>
        </svg>
      );
    case 'ptv':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <rect x="11" y="23" width="58" height="22" rx="4" fill="#DC2626" />
          <text x="27" y="39" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="900">
            PTV
          </text>
          <rect x="41" y="25" width="26" height="18" rx="3" fill="#FFFFFF" />
          <text x="54" y="37.5" textAnchor="middle" fill="#15803D" fontSize="8" fontWeight="900" fontStyle="italic">
            sports
          </text>
          <text x="40" y="57" textAnchor="middle" fill="#15803D" fontSize="7.5" fontWeight="800">
            LIVE HD
          </text>
        </svg>
      );
    case 'nba':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <rect x="14" y="20" width="26" height="38" rx="5" fill="#1D428A" />
          <rect x="40" y="20" width="26" height="38" rx="5" fill="#C8102E" />
          <text x="40" y="44" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="900">
            NBA
          </text>
          <text x="40" y="55" textAnchor="middle" fill="#DBEAFE" fontSize="7" fontWeight="800">
            TV
          </text>
        </svg>
      );
    case 'f1':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <rect x="10" y="23" width="60" height="30" rx="8" fill="#DC2626" />
          <text x="40" y="45" textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="900" fontStyle="italic">
            F1
          </text>
        </svg>
      );
  }
  // Fallback: channel-initials monogram (used when no logo and no known variant)
  const initials =
    (name ?? '')
      .replace(/\(.*?\)/g, ' ')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || 'TV';
  return (
    <span
      aria-hidden="true"
      className="font-display font-extrabold text-[#1D6BFF] text-base sm:text-lg leading-none select-none"
    >
      {initials}
    </span>
  );
};
