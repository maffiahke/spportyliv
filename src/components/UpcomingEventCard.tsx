import React from 'react';
import { Bell, BellRing } from 'lucide-react';
import { UpcomingEvent } from '../types/sports';
import { TeamCrest } from './IconsAndCrests';

interface UpcomingEventCardProps {
  event: UpcomingEvent;
  isNotified: boolean;
  onToggleNotify: (event: UpcomingEvent) => void;
}

export const UpcomingEventCard: React.FC<UpcomingEventCardProps> = ({
  event,
  isNotified,
  onToggleNotify,
}) => {
  return (
    <article className="neu-surface rounded-[22px] px-3 py-3 sm:px-3.5 sm:py-3.5 flex items-stretch gap-3 transition-transform duration-200 hover:-translate-y-0.5">
      {/* Recessed Date Block */}
      <div className="neu-inset-sm w-11 sm:w-12 shrink-0 self-center text-center rounded-2xl py-1.5 px-1">
        <div className="text-[9.5px] font-bold tracking-wider text-slate-600 uppercase">
          {event.dayOfWeek}
        </div>
        <div className="font-display font-extrabold text-[19px] text-slate-950 leading-none my-0.5 tabular-nums">
          {event.dayNumber}
        </div>
        <div className="text-[9.5px] font-semibold text-slate-500 uppercase">
          {event.month}
        </div>
      </div>

      {/* League + teams + kickoff, stacked so full names stay readable */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 min-w-0">
            <TeamCrest crest={event.leagueCrest} className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{event.league}</span>
          </span>
          <button
            type="button"
            onClick={() => onToggleNotify(event)}
            aria-pressed={isNotified}
            aria-label={
              isNotified
                ? `Remove reminder for ${event.homeTeam} vs ${event.awayTeam}`
                : `Notify me for ${event.homeTeam} vs ${event.awayTeam}`
            }
            title={isNotified ? 'Reminder active' : 'Notify me'}
            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              isNotified
                ? 'bg-[#1D6BFF] text-white shadow-[3px_3px_8px_rgba(29,107,255,0.35),-2px_-2px_6px_rgba(255,255,255,0.85)]'
                : 'neu-surface-sm neu-pressable text-[#1D6BFF] hover:text-[#1557D6]'
            }`}
          >
            {isNotified ? (
              <BellRing className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Bell className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="grid grid-cols-[20px_1fr] items-center gap-x-2 gap-y-0.5">
          <TeamCrest crest={event.homeCrest} className="w-5 h-5 shrink-0" />
          <span className="font-display font-bold text-[12.5px] sm:text-[13px] text-slate-900 truncate">
            {event.homeTeam}
          </span>

          <span className="text-[9px] font-bold text-[#2563EB] text-center leading-none">vs</span>
          <span className="text-[10.5px] font-semibold text-slate-500 tabular-nums truncate">
            {event.time}
          </span>

          <TeamCrest crest={event.awayCrest} className="w-5 h-5 shrink-0" />
          <span className="font-display font-bold text-[12.5px] sm:text-[13px] text-slate-900 truncate">
            {event.awayTeam}
          </span>
        </div>
      </div>
    </article>
  );
};
