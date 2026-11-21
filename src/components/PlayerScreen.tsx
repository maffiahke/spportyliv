import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isHlsPlaybackUrl } from '../lib/proxy';
import {
  ArrowLeft,
  Maximize2,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  Tv,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { LiveMatch, TVChannel } from '../types/sports';
import { TeamCrest } from './IconsAndCrests';
import { ChannelBadge } from './ChannelBadge';

interface PlayerScreenProps {
  match: LiveMatch;
  channel?: TVChannel | null;
  liveMatches: LiveMatch[];
  channels: TVChannel[];
  isPlaying: boolean;
  muted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onSelectStream: (match: LiveMatch, channel?: TVChannel | null) => void;
  onEnterPip: () => void;
  onBack: () => void;
}

interface HlsLevel {
  index: number;
  height: number;
  label: string;
}

/** Quality ladder shown in the player — each option caps playback at the
 *  best level the stream provides at or below its height. */
const QUALITY_LADDER: { label: string; cap: number }[] = [
  { label: '2K', cap: 1440 },
  { label: '1080p', cap: 1080 },
  { label: '720p', cap: 720 },
  { label: '480p', cap: 480 },
  { label: '240p', cap: 240 },
];

type RelatedItem =
  | { kind: 'match'; match: LiveMatch }
  | { kind: 'channel'; channel: TVChannel; match: LiveMatch };

const formatMediaTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const PlayerScreen: React.FC<PlayerScreenProps> = ({
  match,
  channel,
  liveMatches,
  channels,
  isPlaying,
  muted,
  onTogglePlay,
  onToggleMute,
  onSelectStream,
  onEnterPip,
  onBack,
}) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line no-undef
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [streamState, setStreamState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryNonce, setRetryNonce] = useState(0);
  // Real HLS quality levels from the stream manifest (null selection = Auto).
  const [hlsLevels, setHlsLevels] = useState<HlsLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState(-1);

  // Multi-stream failover: admin events can carry several sources. The active
  // one plays; when it fails, the player auto-advances to the next stream.
  const streams = useMemo<NonNullable<LiveMatch['streams']>>(() => {
    if (channel) {
      return [{ id: `ch-${channel.id}`, label: channel.name, url: channel.streamUrl ?? '' }];
    }
    if (match.streams && match.streams.length > 0) return match.streams;
    return match.videoUrl ? [{ id: 'primary', label: 'Primary stream', url: match.videoUrl }] : [];
  }, [channel, match.id, match.streams, match.videoUrl]);
  const [streamIndex, setStreamIndex] = useState(0);
  useEffect(() => {
    setStreamIndex(0);
  }, [match.id, channel?.id]);
  const safeStreamIndex = Math.min(streamIndex, Math.max(streams.length - 1, 0));

  const selectQuality = (label: string | null) => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (label === null) {
      setSelectedQuality(null);
      try {
        hls.currentLevel = -1;
      } catch {
        /* noop */
      }
      return;
    }
    const cap = QUALITY_LADDER.find((q) => q.label === label)?.cap ?? 0;
    const heights = hls.levels
      .map((l, i) => ({ i, h: l.height ?? 0 }))
      .filter((x) => x.h > 0);
    if (heights.length === 0) return;
    const capped = heights.filter((x) => x.h <= cap);
    // Best level at/below the cap; if none exists, fall back to the lowest.
    const target = capped.length
      ? capped.reduce((a, b) => (b.h > a.h ? b : a))
      : heights.reduce((a, b) => (b.h < a.h ? b : a));
    setSelectedQuality(label);
    try {
      hls.currentLevel = target.i;
    } catch {
      /* noop */
    }
  };

  const levelLabel = (height: number): string => (height >= 2160 ? '4K' : `${height}p`);

  const retryStream = () => {
    setStreamState('loading');
    setRetryNonce((n) => n + 1);
  };

  const hasNextStream = safeStreamIndex + 1 < streams.length;
  const nextStreamLabel = hasNextStream ? streams[safeStreamIndex + 1].label : null;
  const switchToNextStream = () => {
    if (!hasNextStream) return;
    setStreamState('loading');
    setStreamIndex(safeStreamIndex + 1);
    setRetryNonce((n) => n + 1);
  };

  // Auto-failover: when the active source fails and another one exists, give
  // the current stream a few seconds (Retry still works) then move on.
  useEffect(() => {
    if (streamState !== 'error' || !hasNextStream) return;
    const t = setTimeout(switchToNextStream, 4_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamState, safeStreamIndex, streams.length, retryNonce]);

  const title = channel ? channel.name : match.league;
  const subtitle = channel ? channel.currentShow : match.venue;
  const currentSport = channel ? channel.sport : match.sport;
  // IPTV channels carry their own proxied stream; events play the selected
  // failover source (defaults to the primary). The switcher only appears when
  // an event has more than one source.
  const videoUrl = channel?.streamUrl ?? streams[safeStreamIndex]?.url ?? match.videoUrl;

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [videoUrl, match.id]);

  // Source management: HLS via hls.js, everything else native <video src>.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    let cancelled = false;
    let hls: import('hls.js').default | null = null;
    let cleanupVideoListener: (() => void) | null = null;
    setStreamState('loading');

    if (isHlsPlaybackUrl(videoUrl)) {
      void (async () => {
        try {
          const { default: Hls } = await import('hls.js');
          if (cancelled) return;
          if (Hls.isSupported()) {
            hls = new Hls({
              // Streams are proxied same-origin; keep buffering modest for live.
              lowLatencyMode: true,
              backBufferLength: 30,
              // The rolling upstream keeps only ~2 segments fetchable at a time:
              // hold a tighter buffer, start at the live edge, and retry the
              // playlist quickly so a missed segment can't stall the stream.
              maxBufferLength: 8,
              maxMaxBufferLength: 16,
              maxBufferSize: 30 * 1000 * 1000,
              liveSyncDurationCount: 2,
              liveDurationInfinity: false,
              fragLoadingMaxRetry: 6,
              manifestLoadingMaxRetry: 4,
              levelLoadingMaxRetry: 4,
              fragLoadingRetryDelay: 500,
              manifestLoadingRetryDelay: 500,
            });
            hlsRef.current = hls;
            hls.loadSource(videoUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              const levels = (hls?.levels ?? [])
                .map((l, i) => ({ index: i, height: l.height ?? 0 }))
                .filter((l) => l.height > 0)
                .map((l) => ({ ...l, label: levelLabel(l.height) }));
              if (!cancelled) setHlsLevels(levels);
            });
            hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
              if (!cancelled) setActiveLevel(data.level);
            });
            // The play intent may have fired before the source attached — retry once data flows.
            const tryPlay = () => {
              if (video.paused) video.play().catch(() => {});
            };
            const onReady = () => setStreamState('ready');
            const onWaiting = () =>
              setStreamState((s) => (s === 'error' ? s : 'loading'));
            video.addEventListener('canplay', tryPlay);
            video.addEventListener('canplay', onReady);
            video.addEventListener('playing', onReady);
            video.addEventListener('waiting', onWaiting);
            cleanupVideoListener = () => {
              video.removeEventListener('canplay', tryPlay);
              video.removeEventListener('canplay', onReady);
              video.removeEventListener('playing', onReady);
              video.removeEventListener('waiting', onWaiting);
            };
            hls.on(Hls.Events.ERROR, (_evt, data) => {
              if (data.fatal && videoRef.current) {
                try {
                  hls?.destroy();
                } catch {
                  /* noop */
                }
                hlsRef.current = null;
                setStreamState('error');
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = videoUrl;
          }
        } catch {
          setStreamState('error');
        }
      })();
    } else {
      const onError = () => setStreamState('error');
      const onReady = () => setStreamState('ready');
      video.addEventListener('error', onError);
      video.addEventListener('canplay', onReady);
      cleanupVideoListener = () => {
        video.removeEventListener('error', onError);
        video.removeEventListener('canplay', onReady);
      };
      video.src = videoUrl;
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
      if (!cancelled) {
        setHlsLevels([]);
        setSelectedQuality(null);
        setActiveLevel(-1);
      }
    };
  }, [videoUrl, retryNonce]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    video.muted = muted;
  }, [muted, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    if (isPlaying) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Fallback to muted autoplay if browser blocks unmuted playback
          if (!video.muted) {
            video.muted = true;
            if (!muted) onToggleMute();
            video.play().catch(() => {});
          }
        });
      }
    } else {
      video.pause();
    }
  }, [isPlaying, videoUrl]);

  const relatedItems = useMemo<RelatedItem[]>(() => {
    if (channel) {
      const sameSportChannels = channels.filter(
        (c) => c.id !== channel.id && c.sport === currentSport
      );
      const otherChannels = channels.filter(
        (c) => c.id !== channel.id && c.sport !== currentSport
      );
      const pickedChannels = [...sameSportChannels, ...otherChannels].slice(0, 4);

      const channelItems: RelatedItem[] = pickedChannels.map((c) => ({
        kind: 'channel',
        channel: c,
        match:
          liveMatches.find((m) => m.id === c.linkedMatchId) || liveMatches[0],
      }));

      const relatedMatches: RelatedItem[] = liveMatches
        .filter((m) => m.id !== match.id)
        .slice(0, 2)
        .map((m) => ({ kind: 'match', match: m }));

      return [...channelItems, ...relatedMatches];
    }

    const sameSportChannels = channels
      .filter((c) => c.sport === currentSport)
      .slice(0, 2)
      .map((c) => ({
        kind: 'channel' as const,
        channel: c,
        match:
          liveMatches.find((m) => m.id === c.linkedMatchId) || match,
      }));

    const otherMatches = liveMatches
      .filter((m) => m.id !== match.id)
      .sort((a, b) => {
        const aSame = a.sport === currentSport ? 0 : 1;
        const bSame = b.sport === currentSport ? 0 : 1;
        return aSame - bSame;
      })
      .map((m) => ({ kind: 'match' as const, match: m }));

    return [...sameSportChannels, ...otherMatches].slice(0, 6);
  }, [channel, channels, currentSport, liveMatches, match]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(e.target.value);
    setCurrentTime(nextTime);
    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
    }
  };

  return (
    <div className="space-y-5 pb-6 max-w-4xl mx-auto">
      {/* Match Title & Back Header */}
      <div className="neu-surface rounded-[22px] px-3.5 py-3 sm:px-4 sm:py-3.5 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="neu-surface-sm neu-pressable w-10 h-10 rounded-full flex items-center justify-center text-slate-800 hover:text-[#1D6BFF] transition-colors cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="neu-inset-sm w-10 h-10 rounded-full p-1.5 flex items-center justify-center shrink-0">
          <TeamCrest crest={match.leagueCrest} className="w-full h-full" />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-display font-extrabold text-sm sm:text-lg text-slate-950 truncate">
            {title}
          </h1>
          <p className="text-[11px] sm:text-xs font-medium text-slate-600 truncate">
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onEnterPip}
          aria-label="Minimize to picture-in-picture"
          title="Picture-in-Picture"
          className="neu-surface-sm neu-pressable w-10 h-10 rounded-full flex items-center justify-center text-slate-800 hover:text-[#1D6BFF] transition-colors cursor-pointer shrink-0"
        >
          <PictureInPicture2 className="w-4 h-4" />
        </button>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444] px-2.5 py-1 text-[10.5px] font-display font-extrabold text-white shrink-0">
          LIVE
        </span>
      </div>

      {/* Clean Neumorphic Player View — video frame kept completely clear */}
      <div className="neu-surface rounded-[26px] p-2 sm:p-3 space-y-2">
        <div
          ref={playerContainerRef}
          className="relative aspect-video w-full rounded-[20px] overflow-hidden text-white select-none bg-slate-950"
          style={
            !videoUrl
              ? {
                  background: `linear-gradient(125deg, ${match.leftTheme} 0%, #091326 52%, ${match.rightTheme} 100%)`,
                }
              : undefined
          }
        >
          {videoUrl ? (
            <video
              ref={videoRef}
              playsInline
              loop
              autoPlay
              muted={muted}
              onClick={onTogglePlay}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              className="absolute inset-0 w-full h-full object-cover cursor-pointer"
            />
          ) : (
            /* Subtle Stadium Pitch Visual for Simulated Streams */
            <div
              onClick={onTogglePlay}
              className="absolute inset-0 cursor-pointer"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12)_0%,transparent_66%)]" />
              <div className="absolute inset-x-8 sm:inset-x-14 top-8 bottom-12 border border-white/15 rounded-2xl" />
              <div className="absolute left-1/2 top-8 bottom-12 w-px bg-white/15" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-28 sm:h-28 rounded-full border border-white/15" />
            </div>
          )}

          {/* Loading / buffering state */}
          {videoUrl && streamState === 'loading' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-slate-950/55">
              <span
                aria-hidden="true"
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-[3px] border-white/20 border-t-[#1D6BFF] animate-spin"
              />
              <span className="text-[11px] sm:text-xs font-display font-bold text-white/85">
                Connecting to stream…
              </span>
            </div>
          )}

          {/* Error state with retry + failover */}
          {videoUrl && streamState === 'error' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/70 px-6 text-center">
              <span className="w-9 h-9 rounded-full bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 text-sm font-display font-black">
                !
              </span>
              <span className="text-xs sm:text-sm font-display font-bold text-white/90">
                Stream unavailable
              </span>
              {nextStreamLabel ? (
                <>
                  <span className="text-[11px] font-display font-semibold text-white/70">
                    Switching to “{nextStreamLabel}” automatically…
                  </span>
                  <button
                    type="button"
                    onClick={switchToNextStream}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1D6BFF] hover:bg-[#2563EB] text-white text-xs font-display font-bold px-4 py-2 shadow-lg cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Switch now
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={retryStream}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1D6BFF] hover:bg-[#2563EB] text-white text-xs font-display font-bold px-4 py-2 shadow-lg cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Center Play Button when Paused (only overlay — hidden while playing) */}
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            {!isPlaying && streamState !== 'error' && (
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label="Play stream"
                className="pointer-events-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#1D6BFF] hover:bg-[#2563EB] text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-105 cursor-pointer"
              >
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
              </button>
            )}
          </div>
        </div>

        {/* Detached Control Deck — sits below the video so the frame is never covered */}
        <div className="rounded-[18px] bg-[#E9F1FE] border border-white/85 shadow-[inset_2px_2px_7px_rgba(163,189,226,0.45),inset_-2px_-2px_7px_rgba(255,255,255,0.95)] px-3 py-2.5 sm:px-4 space-y-2">
          {videoUrl && duration > 0 && (
            <div className="flex items-center gap-2.5">
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                aria-label="Seek video"
                className="w-full h-1.5 accent-[#1D6BFF] cursor-pointer"
              />
              <span className="text-[10.5px] font-display font-bold text-slate-600 tabular-nums shrink-0">
                {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
            {/* Transport */}
            <div className="flex items-center gap-2 order-1">
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause stream' : 'Play stream'}
                className="neu-surface-sm neu-pressable w-9 h-9 rounded-full flex items-center justify-center text-slate-800 hover:text-[#1D6BFF] transition-colors cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className={`neu-surface-sm neu-pressable w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  muted ? 'text-[#1D6BFF]' : 'text-slate-800 hover:text-[#1D6BFF]'
                }`}
              >
                {muted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Quality: fixed ladder capped to real stream levels — own scrollable row on mobile */}
            {hlsLevels.length > 0 ? (
              <div
                className="neu-inset-sm flex items-center rounded-full p-0.5 order-3 w-full sm:w-auto sm:order-none max-w-full overflow-x-auto no-scrollbar"
                role="group"
                aria-label="Stream quality"
              >
                <button
                  type="button"
                  onClick={() => selectQuality(null)}
                  title="Automatic quality"
                  className={`shrink-0 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                    selectedQuality === null
                      ? 'bg-[#1D6BFF] text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {selectedQuality === null && activeLevel >= 0
                    ? `Auto · ${levelLabel(hlsLevels.find((l) => l.index === activeLevel)?.height ?? 0)}`
                    : 'Auto'}
                </button>
                {QUALITY_LADDER.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => selectQuality(q.label)}
                    title={`${q.label} — best available up to ${q.label}`}
                    className={`shrink-0 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                      selectedQuality === q.label
                        ? 'bg-[#1D6BFF] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            ) : (
              <span
                title="Automatic quality"
                className="neu-inset-sm order-3 sm:order-none px-3 py-1.5 rounded-full text-[10.5px] font-display font-bold text-slate-600"
              >
                Auto
              </span>
            )}

            {/* Stream failover switcher: shown when the event carries multiple sources */}
            {!channel && streams.length > 1 && (
              <div
                className="neu-inset-sm flex items-center rounded-full p-0.5 order-4 w-full sm:w-auto sm:order-none max-w-full overflow-x-auto no-scrollbar"
                role="group"
                aria-label="Stream source"
              >
                {streams.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (i === safeStreamIndex) return;
                      setStreamState('loading');
                      setStreamIndex(i);
                      setRetryNonce((n) => n + 1);
                    }}
                    title={s.label}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] sm:text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                      i === safeStreamIndex
                        ? 'bg-[#1D6BFF] text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {i === safeStreamIndex ? `● Stream ${i + 1}` : `Stream ${i + 1}`}
                  </button>
                ))}
              </div>
            )}

            {/* Window controls */}
            <div className="flex items-center gap-2 order-2 sm:order-none">
              <button
                type="button"
                onClick={onEnterPip}
                aria-label="Picture in picture mode"
                title="Picture-in-Picture"
                className="neu-surface-sm neu-pressable w-9 h-9 rounded-full flex items-center justify-center text-slate-800 hover:text-[#1D6BFF] transition-colors cursor-pointer"
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const el = playerContainerRef.current || document.documentElement;
                  if (!document.fullscreenElement && el.requestFullscreen) {
                    el.requestFullscreen().catch(() => {});
                  } else if (document.fullscreenElement && document.exitFullscreen) {
                    document.exitFullscreen().catch(() => {});
                  }
                }}
                aria-label="Toggle fullscreen"
                className="neu-surface-sm neu-pressable w-9 h-9 rounded-full flex items-center justify-center text-slate-800 hover:text-[#1D6BFF] transition-colors cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Match identity — teams (or channel) directly below the player */}
      <section
        aria-label="Match details"
        className="neu-surface rounded-[22px] px-3.5 py-3 sm:px-5 sm:py-4"
      >
        {channel ? (
          <div className="flex items-center gap-3">
            <div className="neu-inset-sm w-11 h-11 rounded-full p-2 flex items-center justify-center shrink-0">
              <ChannelBadge variant={channel.logoVariant} name={channel.name} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display font-extrabold text-sm sm:text-base text-slate-950 truncate">
                {channel.name}
              </p>
              <p className="text-[11px] sm:text-xs font-medium text-slate-600 truncate">
                {channel.currentShow}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444] px-2.5 py-1 text-[10.5px] font-display font-extrabold text-white shrink-0">
              LIVE
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
            {/* Home team */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="neu-inset-sm w-11 h-11 sm:w-14 sm:h-14 rounded-full p-1.5 sm:p-2 flex items-center justify-center shrink-0">
                <TeamCrest crest={match.homeCrest} className="w-full h-full drop-shadow" />
              </div>
              <div className="min-w-0">
                <p className="font-display font-extrabold text-xs sm:text-sm leading-tight text-slate-950 line-clamp-2">
                  {match.homeTeam}
                </p>
                <p className="text-[9.5px] sm:text-[10px] font-semibold tracking-[0.06em] text-slate-500 uppercase">
                  Home
                </p>
              </div>
            </div>

            {/* Score / VS + league */}
            <div className="flex flex-col items-center gap-1 shrink-0 px-1">
              {match.homeScore > 0 || match.awayScore > 0 ? (
                <p className="font-display font-black text-lg sm:text-2xl leading-none text-slate-950 tabular-nums">
                  {match.homeScore}
                  <span className="text-slate-400 mx-1 font-bold">–</span>
                  {match.awayScore}
                </p>
              ) : (
                <span className="neu-inset-sm px-3 py-1 rounded-full font-display font-black text-[11px] sm:text-xs text-slate-700">
                  VS
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444] px-2 py-0.5 text-[9px] sm:text-[10px] font-display font-extrabold text-white">
                LIVE
              </span>
              <p className="text-[9.5px] sm:text-[10.5px] font-semibold text-slate-500 text-center leading-tight max-w-[110px] sm:max-w-[150px] truncate">
                {match.league}
              </p>
            </div>

            {/* Away team */}
            <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0 text-right">
              <div className="min-w-0">
                <p className="font-display font-extrabold text-xs sm:text-sm leading-tight text-slate-950 line-clamp-2">
                  {match.awayTeam}
                </p>
                <p className="text-[9.5px] sm:text-[10px] font-semibold tracking-[0.06em] text-slate-500 uppercase">
                  Away
                </p>
              </div>
              <div className="neu-inset-sm w-11 h-11 sm:w-14 sm:h-14 rounded-full p-1.5 sm:p-2 flex items-center justify-center shrink-0">
                <TeamCrest crest={match.awayCrest} className="w-full h-full drop-shadow" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Similar & Related Streams */}
      <section aria-label="Similar and related streams" className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2.5">
            <span className="neu-surface-sm w-8 h-8 rounded-full flex items-center justify-center text-[#1D6BFF] shrink-0">
              <Tv className="w-4 h-4 stroke-[2.2]" />
            </span>
            <h2 className="font-display font-extrabold text-[18px] sm:text-[20px] text-slate-950 tracking-tight">
              Similar &amp; Related
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            {relatedItems.length} live
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {relatedItems.map((item) => {
            if (item.kind === 'match') {
              const m = item.match;
              return (
                <button
                  key={`rel-match-${m.id}`}
                  type="button"
                  onClick={() => onSelectStream(m, null)}
                  className="neu-surface neu-pressable rounded-[20px] p-2.5 flex items-center gap-3 text-left transition-all hover:-translate-y-0.5 cursor-pointer min-h-[76px]"
                >
                  {/* Mini Match Arena Thumbnail */}
                  <div
                    className="relative w-24 h-16 sm:w-28 sm:h-[68px] rounded-[14px] shrink-0 overflow-hidden flex items-center justify-center px-2 shadow-inner"
                    style={{
                      background: `linear-gradient(110deg, ${m.leftTheme} 0%, #1D4ED8 46%, #E11D48 54%, ${m.rightTheme} 100%)`,
                    }}
                  >
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[8.5px] font-display font-extrabold text-white leading-none">
                      LIVE
                    </span>
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <TeamCrest crest={m.homeCrest} className="w-7 h-7 drop-shadow" />
                      <span className="font-display font-black italic text-[10px] text-white/95">
                        VS
                      </span>
                      <TeamCrest crest={m.awayCrest} className="w-7 h-7 drop-shadow" />
                    </div>
                  </div>

                  {/* Match Info */}
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-bold text-[13.5px] sm:text-sm text-slate-950 truncate">
                      {m.homeTeam} vs {m.awayTeam}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-600 min-w-0">
                      <TeamCrest crest={m.leagueCrest} className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{m.league}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums shrink-0">{m.viewers}</span>
                    </div>
                  </div>

                  {/* Red Play Pill */}
                  <span
                    aria-hidden="true"
                    className="w-9 h-9 rounded-full bg-gradient-to-r from-[#EF4444] to-[#DC2626] text-white flex items-center justify-center shrink-0 shadow-[3px_3px_8px_rgba(239,68,68,0.3)]"
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </span>
                </button>
              );
            }

            const ch = item.channel;
            return (
              <button
                key={`rel-channel-${ch.id}`}
                type="button"
                onClick={() => onSelectStream(item.match, ch)}
                className="neu-surface neu-pressable rounded-[20px] p-2.5 flex items-center gap-3 text-left transition-all hover:-translate-y-0.5 cursor-pointer min-h-[76px]"
              >
                {/* Recessed Channel Emblem */}
                <div className="neu-inset-sm w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-[14px] p-1.5 flex items-center justify-center shrink-0">
                  <div className="w-full h-full rounded-full bg-white shadow-sm flex items-center justify-center overflow-hidden p-1">
                    <ChannelBadge variant={ch.logoVariant} name={ch.name} />
                  </div>
                </div>

                {/* Channel Info */}
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-[13.5px] sm:text-sm text-slate-950 truncate">
                    {ch.name}
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-600 truncate">
                    {ch.currentShow}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500">
                    <span className="text-[#EF4444] font-display font-bold">LIVE</span>
                    <span aria-hidden="true">·</span>
                    <span>{ch.quality}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{ch.viewers}</span>
                  </div>
                </div>

                {/* Red Play Pill */}
                <span
                  aria-hidden="true"
                  className="w-9 h-9 rounded-full bg-gradient-to-r from-[#EF4444] to-[#DC2626] text-white flex items-center justify-center shrink-0 shadow-[3px_3px_8px_rgba(239,68,68,0.3)]"
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
