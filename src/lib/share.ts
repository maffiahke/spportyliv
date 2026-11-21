import type { LiveMatch } from '../types/sports';

/** Strip the IPTV id prefix — share/deep links use the raw event id. */
export function rawEventId(matchId: string): string {
  return matchId.replace(/^iptv-(ev|up)-/, '');
}

/**
 * Crawler-friendly share URL: /event/<id> serves Open Graph tags (title,
 * description, event logo as the thumbnail) and redirects into the app,
 * which opens the event's player via /?watch=<id>.
 */
export function eventShareUrl(matchId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/event/${encodeURIComponent(rawEventId(matchId))}`;
}

export function buildEventSharePayload(match: LiveMatch, isUpcoming: boolean): {
  title: string;
  text: string;
  url: string;
} {
  const url = eventShareUrl(match.id);
  const title = `${match.homeTeam} vs ${match.awayTeam} — ${isUpcoming ? 'Upcoming' : 'Live'} on SportyLive`;
  const text = isUpcoming
    ? `Don't miss ${match.homeTeam} vs ${match.awayTeam} (${match.league})${
        match.kickoffLabel ? ` — ${match.kickoffLabel}` : ''
      } on SportyLive!`
    : `Watch ${match.homeTeam} vs ${match.awayTeam} (${match.league}) live now on SportyLive!`;
  return { title, text, url };
}
