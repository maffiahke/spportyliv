import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Check, Clock, Copy, Eye, ExternalLink, Play, Share2, X } from 'lucide-react';
import { LiveMatch } from '../types/sports';
import { eventShareUrl } from '../lib/share';
import { TeamCrest } from './IconsAndCrests';

interface LiveMatchCardProps {
  match: LiveMatch;
  onWatchLive: (match: LiveMatch) => void;
  onShareFeedback?: (message: string) => void;
  /** Reminder state for upcoming fixtures (live cards omit the bell). */
  isNotified?: boolean;
  onToggleNotify?: () => void;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand when clipboard API is restricted
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Ticking countdown copy for upcoming fixtures. */
function formatCountdown(kickoffAt: string, nowMs: number): string {
  const target = Date.parse(kickoffAt);
  if (Number.isNaN(target)) return '';
  const remainingSeconds = Math.floor((target - nowMs) / 1000);
  if (remainingSeconds <= 0) return 'Kicking off now';
  const days = Math.floor(remainingSeconds / 86_400);
  const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = remainingSeconds % 60;
  // Time part only — the chip renders its own 'Starts in ' prefix (hidden on
  // very narrow screens so the minutes never get cut off).
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const LiveMatchCard: React.FC<LiveMatchCardProps> = ({
  match,
  onWatchLive,
  onShareFeedback,
  isNotified = false,
  onToggleNotify,
}) => {
  const isUpcoming = Boolean(match.isUpcoming);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const shareContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // Tick every second so the upcoming kickoff countdown stays live.
  useEffect(() => {
    if (!isUpcoming || !match.kickoffAt) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isUpcoming, match.kickoffAt]);

  const countdownLabel =
    isUpcoming && match.kickoffAt ? formatCountdown(match.kickoffAt, nowMs) : '';

  useEffect(() => {
    if (!shareMenuOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (
        shareContainerRef.current &&
        !shareContainerRef.current.contains(e.target as Node)
      ) {
        setShareMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShareMenuOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [shareMenuOpen]);

  const buildSharePayload = () => {
    // Deep link: /event/<id> carries the OG thumbnail and redirects into the
    // app's player for this event.
    const url = eventShareUrl(match.id);
    const title = `${match.homeTeam} vs ${match.awayTeam} — ${
      isUpcoming ? 'Upcoming' : 'Live'
    } on SportyLive`;
    const text = isUpcoming
      ? `Don't miss ${match.homeTeam} vs ${match.awayTeam} (${match.league})${
          match.kickoffLabel ? ` — ${match.kickoffLabel}` : ''
        } on SportyLive!`
      : `Watch ${match.homeTeam} vs ${match.awayTeam} (${match.league}) live now on SportyLive!`;
    return { title, text, url };
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { url } = buildSharePayload();
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopied(true);
      onShareFeedback?.(`Link copied for ${match.homeTeam} vs ${match.awayTeam}`);
    } else {
      onShareFeedback?.('Unable to copy link in this browser');
    }
    setShareMenuOpen(false);
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (shareMenuOpen) {
      setShareMenuOpen(false);
      return;
    }

    const payload = buildSharePayload();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        onShareFeedback?.(`Shared ${match.homeTeam} vs ${match.awayTeam}`);
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        // If Web Share is blocked (e.g. desktop or iframe policy), open quick share menu
      }
    }

    setShareMenuOpen(true);
  };

  const { text: shareText, url: shareUrl } = buildSharePayload();
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const telegramHref = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
  const xHref = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;

  return (
    <article
      ref={shareContainerRef}
      className="relative neu-surface rounded-[24px] p-2.5 transition-transform duration-200 hover:-translate-y-0.5"
    >
      {/* Arena Visual Banner */}
      <div
        onClick={() => onWatchLive(match)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onWatchLive(match);
          }
        }}
        aria-label={
          isUpcoming
            ? `View ${match.homeTeam} vs ${match.awayTeam} kickoff details`
            : `Watch ${match.homeTeam} vs ${match.awayTeam} live`
        }
        className="relative rounded-[18px] overflow-hidden cursor-pointer select-none min-h-[154px] sm:min-h-[170px] flex flex-col justify-between p-3 sm:p-4 shadow-inner"
        style={{
          background: `linear-gradient(108deg, ${match.leftTheme} 0%, #1D4ED8 46%, #E11D48 54%, ${match.rightTheme} 100%)`,
        }}
      >
        {/* Stadium atmosphere & diagonal slash */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage:
                'radial-gradient(circle at 22% 28%, rgba(147,197,253,0.5) 0%, transparent 48%), radial-gradient(circle at 78% 28%, rgba(251,113,133,0.45) 0%, transparent 48%)',
            }}
          />
          {/* Stadium lower bowl vignette */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent" />
          {/* Glowing diagonal energy slash */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 rotate-[18deg] scale-y-125 bg-gradient-to-b from-white/10 via-rose-300/90 to-white/10 blur-[1.5px]"
          />
        </div>

        {/* Top Row: LIVE + Viewers on Left, Share Button on Right */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-display font-extrabold tracking-wide text-white shadow-sm ${
                isUpcoming ? 'bg-[#1D6BFF]' : 'bg-[#EF4444]'
              }`}
            >
              {isUpcoming ? 'UPCOMING' : 'LIVE'}
            </span>
            {isUpcoming ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/60 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-semibold text-white tabular-nums whitespace-nowrap" title={match.kickoffLabel}>
                <Clock className="w-3.5 h-3.5 text-slate-200 shrink-0" />
                {countdownLabel ? (
                  <>
                    <span className="hidden min-[430px]:inline">Starts in </span>
                    {countdownLabel}
                  </>
                ) : (
                  <>{match.kickoffLabel || 'Kickoff soon'}</>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/60 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                <Eye className="w-3.5 h-3.5 text-slate-200" />
                <span>{match.viewers}</span>
              </span>
            )}
            {isUpcoming && onToggleNotify && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleNotify();
                }}
                onKeyDown={(e) => e.stopPropagation()}
                aria-pressed={isNotified}
                aria-label={
                  isNotified
                    ? `Remove reminder for ${match.homeTeam} vs ${match.awayTeam}`
                    : `Notify me for ${match.homeTeam} vs ${match.awayTeam}`
                }
                title={isNotified ? 'Reminder active' : 'Notify me'}
                className={`w-7 h-7 rounded-full backdrop-blur-sm flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 ${
                  isNotified
                    ? 'bg-[#1D6BFF] text-white'
                    : 'bg-slate-950/55 hover:bg-slate-950/80 text-white'
                }`}
              >
                {isNotified ? (
                  <BellRing className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Bell className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleShareClick}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`Share ${match.homeTeam} vs ${match.awayTeam}`}
            aria-expanded={shareMenuOpen}
            title="Share match"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-950/55 hover:bg-slate-950/80 backdrop-blur-sm text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Center Teams & VS */}
        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 my-auto py-2">
          {/* Home Team */}
          <div className="flex flex-col items-center text-center">
            <TeamCrest
              crest={match.homeCrest}
              className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
            />
            <span className="mt-1.5 font-display font-bold text-[13px] sm:text-base text-white tracking-tight drop-shadow-sm leading-tight line-clamp-2 break-words max-w-full">
              {match.homeTeam}
            </span>
          </div>

          {/* Center VS */}
          <div className="flex flex-col items-center justify-center px-1">
            <span className="font-display font-black italic text-2xl sm:text-3xl text-white tracking-tight drop-shadow-[0_2px_12px_rgba(244,63,94,0.85)]">
              VS
            </span>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center text-center">
            <TeamCrest
              crest={match.awayCrest}
              className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
            />
            <span className="mt-1.5 font-display font-bold text-[13px] sm:text-base text-white tracking-tight drop-shadow-sm leading-tight line-clamp-2 break-words max-w-full">
              {match.awayTeam}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Social & Clipboard Share Popover */}
      {shareMenuOpen && (
        <div
          role="dialog"
          aria-label={`Share ${match.homeTeam} vs ${match.awayTeam}`}
          onClick={(e) => e.stopPropagation()}
          className="neu-surface absolute top-12 right-3.5 z-30 w-52 rounded-[18px] p-2 shadow-[0_14px_30px_rgba(15,43,115,0.22)] space-y-0.5"
        >
          <div className="flex items-center justify-between px-2 py-1">
            <span className="font-display font-bold text-[11px] text-slate-500 truncate">
              Share Match
            </span>
            <button
              type="button"
              onClick={() => setShareMenuOpen(false)}
              aria-label="Close share menu"
              className="w-5 h-5 rounded-full hover:bg-white/70 flex items-center justify-center text-slate-500 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-display font-bold text-slate-800 hover:bg-white/70 hover:text-[#1D6BFF] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-[#1D6BFF]" />
              <span>Copy Match Link</span>
            </span>
          </button>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              setShareMenuOpen(false);
              onShareFeedback?.('Opening WhatsApp share');
            }}
            className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-display font-bold text-slate-800 hover:bg-white/70 hover:text-[#16A34A] transition-colors"
          >
            <span>WhatsApp</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <a
            href={telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              setShareMenuOpen(false);
              onShareFeedback?.('Opening Telegram share');
            }}
            className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-display font-bold text-slate-800 hover:bg-white/70 hover:text-[#229ED9] transition-colors"
          >
            <span>Telegram</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <a
            href={xHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              setShareMenuOpen(false);
              onShareFeedback?.('Opening X share');
            }}
            className="w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-display font-bold text-slate-800 hover:bg-white/70 hover:text-slate-950 transition-colors"
          >
            <span>Post on X</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      )}

      {/* Bottom League & Red Watch Live Tab */}
      <div className="pt-2.5 pb-0.5 px-1 flex items-center justify-between gap-2">
        <div className="neu-inset-sm rounded-full px-3 py-1.5 inline-flex items-center gap-2 min-w-0">
          <TeamCrest crest={match.leagueCrest} className="w-5 h-5 shrink-0" />
          <span className="font-display font-bold text-xs sm:text-[13px] text-slate-900 truncate">
            {match.league}
          </span>
          {isUpcoming && match.kickoffLabel && (
            <span className="hidden sm:inline text-[10.5px] font-medium text-slate-500 truncate">
              · {match.kickoffLabel}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onWatchLive(match)}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r active:scale-[0.98] transition-all px-4 py-2 min-h-[38px] sm:min-h-[40px] text-white font-display font-bold text-xs sm:text-[13px] cursor-pointer whitespace-nowrap ${
            isUpcoming
              ? 'from-[#1D6BFF] to-[#1E40AF] hover:from-[#1557D6] hover:to-[#1E3A8A] shadow-[4px_4px_12px_rgba(29,107,255,0.35),-2px_-2px_8px_rgba(255,255,255,0.7)]'
              : 'from-[#EF4444] to-[#DC2626] hover:from-[#DC2626] hover:to-[#B91C1C] shadow-[4px_4px_12px_rgba(239,68,68,0.35),-2px_-2px_8px_rgba(255,255,255,0.7)]'
          }`}
        >
          {isUpcoming ? (
            <Clock className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>
            {isUpcoming
              ? match.videoUrl
                ? 'Preview'
                : 'Kickoff Info'
              : 'Watch Live'}
          </span>
        </button>
      </div>
    </article>
  );
};
