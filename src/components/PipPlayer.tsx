import React, { useEffect, useRef, useState } from 'react';
import {
  GripHorizontal,
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { LiveMatch, TVChannel } from '../types/sports';
import { isHlsPlaybackUrl } from '../lib/proxy';

interface PipPlayerProps {
  match: LiveMatch;
  channel?: TVChannel | null;
  isPlaying: boolean;
  muted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onExpand: () => void;
  onClose: () => void;
}

const PIP_MARGIN = 12;

export const PipPlayer: React.FC<PipPlayerProps> = ({
  match,
  channel,
  isPlaying,
  muted,
  onTogglePlay,
  onToggleMute,
  onExpand,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragging: boolean;
  } | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 16, y: 120 };
    const isDesktop = window.innerWidth >= 1024;
    const pipW = isDesktop ? 290 : 224;
    const pipH = isDesktop ? 204 : 168;
    const bottomReserve = isDesktop ? 24 : 84;
    return {
      x: Math.max(PIP_MARGIN, window.innerWidth - pipW - PIP_MARGIN),
      y: Math.max(PIP_MARGIN, window.innerHeight - pipH - bottomReserve),
    };
  });

  const clampPosition = (x: number, y: number) => {
    const el = containerRef.current;
    const width = el?.offsetWidth ?? (window.innerWidth >= 1024 ? 290 : 224);
    const height = el?.offsetHeight ?? (window.innerWidth >= 1024 ? 204 : 168);
    const maxX = Math.max(PIP_MARGIN, window.innerWidth - width - PIP_MARGIN);
    const maxY = Math.max(PIP_MARGIN, window.innerHeight - height - PIP_MARGIN);
    return {
      x: Math.min(Math.max(PIP_MARGIN, x), maxX),
      y: Math.min(Math.max(PIP_MARGIN, y), maxY),
    };
  };

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    // IPTV channels carry their own stream; events use the match stream.
    const streamUrl = channel?.streamUrl ?? match.videoUrl;
    if (!video || !streamUrl) return;
    let cancelled = false;
    let hls: import('hls.js').default | null = null;
    let cleanupVideoListener: (() => void) | null = null;

    if (isHlsPlaybackUrl(streamUrl)) {
      void (async () => {
        try {
          const { default: Hls } = await import('hls.js');
          if (cancelled) return;
          if (Hls.isSupported()) {
            hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
            hlsRef.current = hls;
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            // Play intent may fire before the source attaches — retry on every
            // readiness signal; fall back to muted playback if blocked.
            const tryPlay = () => {
              if (!video.paused) return;
              video.play().catch(() => {
                video.muted = true;
                video.play().catch(() => {});
              });
            };
            const onReady = () => {
              tryPlay();
              cleanupVideoListener?.();
              cleanupVideoListener = null;
            };
            video.addEventListener('canplay', onReady);
            video.addEventListener('loadeddata', onReady);
            cleanupVideoListener = () => {
              video.removeEventListener('canplay', onReady);
              video.removeEventListener('loadeddata', onReady);
            };
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
          }
        } catch {
          /* noop */
        }
      })();
    } else {
      video.src = streamUrl;
    }

    return () => {
      cancelled = true;
      cleanupVideoListener?.();
      try {
        hls?.destroy();
      } catch {
        /* noop */
      }
      if (hlsRef.current === hls) hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [channel?.streamUrl, match.videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    const streamUrl = channel?.streamUrl ?? match.videoUrl;
    if (!video || !streamUrl) return;
    video.muted = muted;
  }, [muted, channel?.streamUrl, match.videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    const streamUrl = channel?.streamUrl ?? match.videoUrl;
    if (!video || !streamUrl) return;
    if (isPlaying) {
      video.play().catch(() => {
        if (!video.muted) {
          video.muted = true;
          video.play().catch(() => {});
        }
      });
    } else {
      video.pause();
    }
  }, [isPlaying, channel?.streamUrl, match.videoUrl]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (!state.dragging && Math.hypot(dx, dy) > 4) {
        state.dragging = true;
      }
      if (state.dragging) {
        setPosition(clampPosition(state.originX + dx, state.originY + dy));
      }
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: position.x,
      originY: position.y,
      dragging: false,
    };
  };

  const title = channel ? channel.name : `${match.homeTeam} vs ${match.awayTeam}`;
  const streamUrl = channel?.streamUrl ?? match.videoUrl;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`Picture in picture: ${title}`}
      onPointerDown={handlePointerDown}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      className="fixed top-0 left-0 z-50 w-[228px] sm:w-[296px] neu-surface rounded-[20px] p-1.5 touch-none select-none cursor-grab active:cursor-grabbing"
    >
      {/* Drag Header */}
      <div className="flex items-center justify-between gap-1.5 px-1 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="w-2 h-2 rounded-full bg-[#EF4444] shrink-0 animate-pulse" />
          <span className="font-display font-bold text-[11px] text-slate-900 truncate">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onExpand}
            aria-label="Return to full player screen"
            title="Expand player"
            className="neu-surface-sm w-6 h-6 rounded-full flex items-center justify-center text-slate-700 hover:text-[#1D6BFF] cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close picture in picture"
            title="Close player"
            className="neu-surface-sm w-6 h-6 rounded-full flex items-center justify-center text-slate-700 hover:text-rose-600 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Mini 16:9 Video Viewport — kept clear of controls */}
      <div
        onClick={onTogglePlay}
        className="relative aspect-video w-full rounded-[14px] overflow-hidden bg-slate-950 cursor-pointer"
        style={
          !streamUrl
            ? {
                background: `linear-gradient(125deg, ${match.leftTheme} 0%, #091326 52%, ${match.rightTheme} 100%)`,
              }
            : undefined
        }
      >
        {streamUrl ? (
          <video
            ref={videoRef}
            playsInline
            loop
            autoPlay
            muted={muted}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          /* Subtle Pitch Visual */
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14)_0%,transparent_66%)]" />
            <div className="absolute inset-x-4 top-3 bottom-3 border border-white/15 rounded-lg" />
            <div className="absolute left-1/2 top-3 bottom-3 w-px bg-white/15" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-white/15" />
          </div>
        )}

        {/* Corner status badges */}
        <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1">
          <span className="rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[8.5px] font-display font-extrabold tracking-wide text-white">
            LIVE
          </span>
          {channel ? (
            <span className="rounded-full bg-slate-950/60 px-1.5 py-0.5 text-[8.5px] font-display font-bold text-white">
              {channel.quality}
            </span>
          ) : null}
        </div>
        {!channel && (
          <span className="absolute top-1.5 right-1.5 z-10 rounded-full bg-slate-950/60 px-1.5 py-0.5 text-[9.5px] font-display font-bold tabular-nums text-white">
            {match.homeScore} - {match.awayScore}
          </span>
        )}

        {/* Center Play Trigger when Paused (only overlay while paused) */}
        {!isPlaying && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlay();
              }}
              aria-label="Play stream"
              className="w-9 h-9 rounded-full bg-[#1D6BFF] text-white flex items-center justify-center shadow-lg cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </button>
          </div>
        )}
      </div>

      {/* Detached Mini Control Deck — below the video */}
      <div className="mt-1.5 rounded-[12px] bg-[#E9F1FE] border border-white/85 shadow-[inset_1.5px_1.5px_5px_rgba(163,189,226,0.45),inset_-1.5px_-1.5px_5px_rgba(255,255,255,0.95)] px-1.5 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
            className="neu-surface-sm w-7 h-7 rounded-full flex items-center justify-center text-slate-800 hover:text-[#1D6BFF] cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-3 h-3 fill-current" />
            ) : (
              <Play className="w-3 h-3 fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className={`neu-surface-sm w-7 h-7 rounded-full flex items-center justify-center cursor-pointer ${
              muted ? 'text-[#1D6BFF]' : 'text-slate-800 hover:text-[#1D6BFF]'
            }`}
          >
            {muted ? (
              <VolumeX className="w-3 h-3" />
            ) : (
              <Volume2 className="w-3 h-3" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onExpand}
          className="neu-surface-sm inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-display font-bold text-slate-700 hover:text-[#1D6BFF] cursor-pointer"
        >
          <Maximize2 className="w-3 h-3" />
          Expand
        </button>
      </div>
    </div>
  );
};
