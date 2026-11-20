import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { LiveMatch, SportCategoryId, TVChannel } from '../types/sports';
import type { AdsSettings } from '../types/iptv';
import { ChannelBadge } from './ChannelBadge';
import { AdSlot } from './ads/AdSlot';

interface LiveTVViewProps {
  channels: TVChannel[];
  liveMatches: LiveMatch[];
  onWatchMatch: (match: LiveMatch, channel?: TVChannel) => void;
  ads?: AdsSettings | null;
}

export const LiveTVView: React.FC<LiveTVViewProps> = ({
  channels,
  liveMatches,
  onWatchMatch,
  ads,
}) => {
  const [sportFilter, setSportFilter] = useState<SportCategoryId>('all');
  const [expandedFeatured, setExpandedFeatured] = useState(false);
  const [expandedRecent, setExpandedRecent] = useState(false);
  const [expandedPopular, setExpandedPopular] = useState(false);
  // Desktop shelves show a capped default slice; "View All" reveals everything.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const filtered =
    sportFilter === 'all'
      ? channels
      : channels.filter((ch) => ch.sport === sportFilter);

  // Channels explicitly curated into the popular shelf by admin.
  const curatedPopular = filtered.filter((ch) => ch.shelf === 'popular');
  // Legacy/all-recent data: promote well-known channel brands so the
  // "Popular Channels" shelf is never empty.
  const POPULAR_RE =
    /bein|sky ?sport|espn|fifa\+|real madrid|mutv|barc[ae]|supersport|dazn|eurosport|bt sport|fox ?sport|star ?sport|ten ?sport|willow|ptv ?sport|tnt ?sport|canal\+? ?sport|arena ?sport/i;
  const autoPopular =
    curatedPopular.length >= 6
      ? []
      : filtered
          .filter(
            (ch) =>
              ch.shelf !== 'featured' &&
              ch.shelf !== 'popular' &&
              POPULAR_RE.test(ch.name),
          )
          .slice(0, 24);
  const popularIds = new Set([...curatedPopular, ...autoPopular].map((ch) => ch.id));

  const featuredChannelsFull = filtered.filter((ch) => ch.shelf === 'featured');
  const popularChannels = [...curatedPopular, ...autoPopular];
  const recentChannelsFull = filtered.filter(
    (ch) => ch.shelf === 'recent' && !popularIds.has(ch.id),
  );
  // Cap default desktop shelves so Popular stays within reach.
  const featuredChannels = !expandedFeatured && isDesktop ? featuredChannelsFull.slice(0, 12) : featuredChannelsFull;
  const recentChannels = !expandedRecent && isDesktop ? recentChannelsFull.slice(0, 24) : recentChannelsFull;
  const popularShelfChannels = !expandedPopular && isDesktop ? popularChannels.slice(0, 12) : popularChannels;

  const handleTuneIn = (channel: TVChannel) => {
    const match =
      liveMatches.find((m) => m.id === channel.linkedMatchId) || liveMatches[0];
    if (match) {
      onWatchMatch(match, channel);
    }
  };

  return (
    <div className="space-y-6 pb-2">
      {/* Light Neumorphic Sport Filter Strip (sticky on desktop) */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 px-0.5 lg:sticky lg:top-[70px] lg:z-20 lg:rounded-2xl lg:bg-[#EAF2FF]/92 lg:backdrop-blur-md lg:py-2">
        {(
          [
            { id: 'all', label: 'All Channels' },
            { id: 'cricket', label: 'Cricket' },
            { id: 'football', label: 'Football' },
            { id: 'basketball', label: 'Basketball' },
            { id: 'boxing', label: 'Boxing' },
            { id: 'f1', label: 'F1' },
            { id: 'tennis', label: 'Tennis' },
          ] as const
        ).map((tab) => {
          const active = sportFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSportFilter(tab.id)}
              className={`px-4 py-2 rounded-full text-xs font-display font-bold whitespace-nowrap transition-all cursor-pointer min-h-[38px] ${
                active
                  ? 'bg-[#1D6BFF] text-white shadow-[4px_4px_12px_rgba(29,107,255,0.35),-3px_-3px_10px_rgba(255,255,255,0.8)]'
                  : 'bg-[#EEF4FF] text-slate-700 border border-white/80 shadow-[4px_4px_10px_rgba(163,189,226,0.42),-4px_-4px_10px_rgba(255,255,255,0.92)] hover:text-[#1D6BFF]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Featured Channels Shelf */}
      {featuredChannelsFull.length > 0 && (
        <ChannelShelf
          title="Featured Channels"
          channels={featuredChannels}
          expanded={expandedFeatured}
          onToggleExpand={() => setExpandedFeatured((v) => !v)}
          onSelectChannel={handleTuneIn}
        />
      )}

      {/* Shelf divider unit: after the leading shelves, before Popular */}
      {(featuredChannelsFull.length > 0 || recentChannelsFull.length > 0) && (
        <AdSlot placement="tv-shelf" ads={ads} />
      )}

      {/* Recently Added Channels Shelf — two rows */}
      {recentChannelsFull.length > 0 && (
        <ChannelShelf
          title="Recently Added Channels"
          channels={recentChannels}
          rows={2}
          expanded={expandedRecent}
          onToggleExpand={() => setExpandedRecent((v) => !v)}
          onSelectChannel={handleTuneIn}
        />
      )}

      {/* Popular Channels Shelf */}
      {popularChannels.length > 0 && (
        <ChannelShelf
          title="Popular Channels"
          channels={popularShelfChannels}
          rows={1}
          expanded={expandedPopular}
          onToggleExpand={() => setExpandedPopular((v) => !v)}
          onSelectChannel={handleTuneIn}
        />
      )}

      {featuredChannelsFull.length === 0 && recentChannelsFull.length === 0 && popularChannels.length === 0 && (
        <div className="rounded-[24px] bg-[#EEF4FF] p-8 text-center border border-white/80 shadow-[6px_6px_16px_rgba(163,189,226,0.45),-6px_-6px_16px_rgba(255,255,255,0.92)]">
          <p className="font-display font-bold text-slate-900 text-sm">
            No live TV channels in this category right now
          </p>
          <button
            type="button"
            onClick={() => setSportFilter('all')}
            className="mt-3 rounded-full bg-[#1D6BFF] text-white font-display font-bold text-xs px-4 py-2 cursor-pointer shadow-sm"
          >
            Show All Channels
          </button>
        </div>
      )}
    </div>
  );
};

interface ChannelShelfProps {
  title: string;
  channels: TVChannel[];
  rows?: 1 | 2;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectChannel: (channel: TVChannel) => void;
}

const ChannelShelf: React.FC<ChannelShelfProps> = ({
  title,
  channels,
  rows = 1,
  expanded,
  onToggleExpand,
  onSelectChannel,
}) => {
  return (
    <section aria-label={title} className="space-y-3.5">
      {/* Shelf Header */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 className="font-display font-extrabold text-[19px] sm:text-[22px] text-slate-950 tracking-tight">
          {title}
        </h2>

        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex items-center gap-0.5 rounded-full bg-[#EEF4FF] px-3.5 py-1.5 text-xs font-display font-bold text-[#1D6BFF] border border-white/85 shadow-[4px_4px_10px_rgba(163,189,226,0.45),-4px_-4px_10px_rgba(255,255,255,0.95)] hover:text-[#1557D6] active:shadow-[inset_3px_3px_6px_rgba(163,189,226,0.45),inset_-3px_-3px_6px_rgba(255,255,255,0.9)] transition-all cursor-pointer whitespace-nowrap min-h-[34px]"
        >
          <span>{expanded ? 'Show Less' : 'View All'}</span>
          <ChevronRight
            className={`w-3.5 h-3.5 stroke-[2.5] transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        </button>
      </div>

      {/* Horizontal Scrollable Shelf (1 or 2 rows) on mobile — dense grid on desktop */}
      <div
        className={
          expanded
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 p-1'
            : rows === 2
              ? 'grid grid-rows-2 grid-flow-col auto-cols-[138px] sm:auto-cols-[172px] gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2 px-1 -mx-1 lg:grid-rows-none lg:grid-flow-row lg:grid-cols-4 xl:grid-cols-6 lg:overflow-visible lg:py-2 lg:px-1 lg:mx-0'
              : 'flex items-stretch gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-2 px-1 -mx-1 lg:grid lg:grid-cols-4 xl:grid-cols-6 lg:overflow-visible lg:py-2 lg:px-1 lg:mx-0'
        }
      >
        {channels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => onSelectChannel(channel)}
            aria-label={`Watch ${channel.name} (${channel.quality})`}
            className={`group rounded-[22px] sm:rounded-[24px] bg-[#EEF4FF] p-3.5 sm:p-5 flex flex-col items-center justify-center text-center border border-white/80 shadow-[6px_6px_14px_rgba(163,189,226,0.5),-6px_-6px_14px_rgba(255,255,255,0.94)] hover:-translate-y-0.5 hover:shadow-[8px_8px_18px_rgba(163,189,226,0.58),-8px_-8px_18px_rgba(255,255,255,0.98)] active:translate-y-0 active:shadow-[inset_5px_5px_11px_rgba(163,189,226,0.5),inset_-5px_-5px_11px_rgba(255,255,255,0.92)] transition-all duration-200 cursor-pointer ${
              expanded ? 'w-full' : 'w-[138px] sm:w-[172px] shrink-0 lg:w-auto lg:shrink'
            }`}
          >
            {/* Recessed Neumorphic Circular Well + Channel Disc (logo or badge) */}
            <div className="w-[68px] h-[68px] sm:w-[82px] sm:h-[82px] rounded-full bg-[#E5EEFD] shadow-[inset_4px_4px_8px_rgba(163,189,226,0.52),inset_-4px_-4px_8px_rgba(255,255,255,0.95)] p-1.5 flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
              <div className="relative w-full h-full rounded-full bg-white shadow-[0_2px_8px_rgba(37,99,235,0.1)] flex items-center justify-center overflow-hidden p-1.5">
                <ChannelBadge variant={channel.logoVariant} name={channel.name} />
                {channel.logoUrl && (
                  <img
                    src={channel.logoUrl}
                    alt={`${channel.name} logo`}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                    className="absolute inset-0 w-full h-full object-contain p-1.5"
                  />
                )}
              </div>
            </div>

            {/* Channel Name */}
            <span className="mt-3 font-display font-bold text-[13px] sm:text-sm text-slate-900 leading-tight truncate w-full">
              {channel.name}
            </span>

            {/* Live Red Dot + HD/4K Label */}
            <span className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-display font-semibold text-slate-500">
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" aria-hidden="true" />
              <span>{channel.quality}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
