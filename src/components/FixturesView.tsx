import React, { useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { LiveMatch, SportCategoryId, UpcomingEvent } from '../types/sports';
import type { AdsSettings } from '../types/iptv';
import { UpcomingEventCard } from './UpcomingEventCard';
import { LiveMatchCard } from './LiveMatchCard';
import { AdSlot } from './ads/AdSlot';

interface FixturesViewProps {
  upcomingMatches: LiveMatch[];
  scheduledEvents: UpcomingEvent[];
  notifiedIds: string[];
  onToggleNotify: (event: UpcomingEvent) => void;
  onToggleUpcomingNotify: (matchId: string) => void;
  onWatchMatch: (match: LiveMatch) => void;
  ads?: AdsSettings | null;
}

const DATE_OPTIONS = [
  { key: 'all', day: 'ALL', num: '•', label: 'All Dates' },
  { key: '2026-11-22', day: 'SAT', num: '22', label: 'Nov 22' },
  { key: '2026-11-23', day: 'SUN', num: '23', label: 'Nov 23' },
  { key: '2026-11-24', day: 'MON', num: '24', label: 'Nov 24' },
  { key: '2026-11-25', day: 'TUE', num: '25', label: 'Nov 25' },
  { key: '2026-11-29', day: 'SAT', num: '29', label: 'Nov 29' },
];

export const FixturesView: React.FC<FixturesViewProps> = ({
  upcomingMatches,
  scheduledEvents,
  notifiedIds,
  onToggleNotify,
  onToggleUpcomingNotify,
  onWatchMatch,
  ads,
}) => {
  const [selectedDate, setSelectedDate] = useState('all');
  const [selectedSport, setSelectedSport] = useState<SportCategoryId>('all');

  const dateMatches = (dateKey?: string) =>
    selectedDate === 'all' || dateKey === selectedDate;
  const sportMatches = (sport: SportCategoryId) =>
    selectedSport === 'all' || sport === selectedSport;

  const filteredUpcoming = upcomingMatches.filter(
    (match) => dateMatches(match.dateKey) && sportMatches(match.sport)
  );
  const filteredScheduled = scheduledEvents.filter(
    (ev) => dateMatches(ev.dateKey) && sportMatches(ev.sport)
  );
  const hasResults = filteredUpcoming.length > 0 || filteredScheduled.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="neu-surface-sm w-10 h-10 rounded-full flex items-center justify-center text-[#1D6BFF]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-xl text-slate-950">
              Match Fixtures
            </h1>
            <p className="text-xs text-slate-600">
              Kickoff countdowns and scheduled fixtures
            </p>
          </div>
        </div>
      </div>

      {/* Horizontal Neumorphic Date Scroller */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1.5 px-0.5">
        {DATE_OPTIONS.map((d) => {
          const active = selectedDate === d.key;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setSelectedDate(d.key)}
              className={`min-w-[64px] rounded-2xl px-3 py-2 text-center transition-all cursor-pointer shrink-0 ${
                active
                  ? 'bg-[#1D6BFF] text-white shadow-[4px_4px_12px_rgba(29,107,255,0.35),-3px_-3px_10px_rgba(255,255,255,0.8)]'
                  : 'neu-surface-sm neu-pressable text-slate-700 hover:text-[#1D6BFF]'
              }`}
            >
              <div className={`text-[10px] font-bold ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                {d.day}
              </div>
              <div className="font-display font-extrabold text-base leading-tight tabular-nums">
                {d.num}
              </div>
            </button>
          );
        })}
      </div>

      {/* Neumorphic Sport Filter Strip */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5">
        {(
          [
            { id: 'all', label: 'All Sports' },
            { id: 'football', label: 'Football' },
            { id: 'basketball', label: 'Basketball' },
            { id: 'tennis', label: 'Tennis' },
            { id: 'boxing', label: 'Boxing' },
            { id: 'f1', label: 'F1' },
          ] as const
        ).map((s) => {
          const active = selectedSport === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSport(s.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-display font-bold whitespace-nowrap transition-all cursor-pointer min-h-[36px] ${
                active
                  ? 'neu-inset-sm text-[#1D6BFF]'
                  : 'neu-surface-sm text-slate-700 hover:text-[#1D6BFF]'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {!hasResults ? (
        <div className="neu-surface rounded-[24px] p-8 text-center">
          <p className="font-display font-bold text-slate-900">
            No fixtures found for this date and sport
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedDate('all');
              setSelectedSport('all');
            }}
            className="mt-3 rounded-full bg-[#1D6BFF] text-white text-xs font-bold px-4 py-2 cursor-pointer shadow-sm"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* Upcoming: kickoff within 4 hours, live-card design + countdown */}
          {filteredUpcoming.length > 0 && (
            <section aria-label="Upcoming fixtures" className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2.5">
                  <span className="neu-surface-sm w-8 h-8 rounded-full flex items-center justify-center text-[#1D6BFF] shrink-0">
                    <Clock className="w-4 h-4 stroke-[2.3]" />
                  </span>
                  <div>
                    <h2 className="font-display font-extrabold text-base text-slate-950">
                      Upcoming
                    </h2>
                    <p className="text-[11px] font-medium text-slate-500">
                      Kickoff within 4 hours · live countdown
                    </p>
                  </div>
                </div>
                <span className="neu-inset-sm inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-display font-bold text-[#1D6BFF] whitespace-nowrap">
                  {filteredUpcoming.length} soon
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUpcoming.map((match) => (
                  <LiveMatchCard
                    key={match.id}
                    match={match}
                    onWatchLive={onWatchMatch}
                    onShareFeedback={() => undefined}
                    isNotified={notifiedIds.includes(match.id)}
                    onToggleNotify={() => onToggleUpcomingNotify(match.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Divider unit between the two fixture groups */}
          {filteredUpcoming.length > 0 && filteredScheduled.length > 0 && (
            <AdSlot placement="fixtures-divider" ads={ads} />
          )}

          {/* Scheduled: 5+ hours away, compact fixture cards */}
          {filteredScheduled.length > 0 && (
            <section aria-label="Scheduled fixtures" className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <div>
                  <h2 className="font-display font-extrabold text-base text-slate-950">
                    Scheduled
                  </h2>
                  <p className="text-[11px] font-medium text-slate-500">
                    5+ hours to kickoff
                  </p>
                </div>
                <span className="neu-inset-sm inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-display font-bold text-slate-600 whitespace-nowrap">
                  {filteredScheduled.length} fixtures
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredScheduled.map((event) => (
                  <UpcomingEventCard
                    key={event.id}
                    event={event}
                    isNotified={notifiedIds.includes(event.id)}
                    onToggleNotify={onToggleNotify}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
