import type { AdminUpcomingEvent, IptvSport } from '../types/iptv';

interface SeedFixture {
  slot: 'upcoming' | 'scheduled';
  offsetHours: number;
  homeTeam: string;
  awayTeam: string;
  sport: IptvSport;
  league: string;
  channel: string;
  streamUrl?: string;
}

/**
 * Demo fixtures used on a fresh install. Offsets are relative to the moment the
 * store is created, so the Upcoming window always has four live-style cards and
 * Scheduled always has four compact cards.
 */
const SEED_FIXTURES: SeedFixture[] = [
  // Upcoming: kickoff within the next 4 hours.
  {
    slot: 'upcoming',
    offsetHours: 0.75,
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    sport: 'football',
    league: 'Premier League',
    channel: 'Sky Sports PL',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    slot: 'upcoming',
    offsetHours: 1.75,
    homeTeam: 'Real Madrid',
    awayTeam: 'Sevilla',
    sport: 'football',
    league: 'LaLiga',
    channel: 'SportyLive 1 HD',
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    slot: 'upcoming',
    offsetHours: 2.75,
    homeTeam: 'LA Lakers',
    awayTeam: 'Golden State Warriors',
    sport: 'basketball',
    league: 'NBA',
    channel: 'NBA CourtSide',
  },
  {
    slot: 'upcoming',
    offsetHours: 3.5,
    homeTeam: 'Alcaraz',
    awayTeam: 'Sinner',
    sport: 'tennis',
    league: 'ATP Finals',
    channel: 'Tennis Center Court',
  },
  // Scheduled: 5+ hours to kickoff.
  {
    slot: 'scheduled',
    offsetHours: 5.25,
    homeTeam: 'Bayern Munich',
    awayTeam: 'Dortmund',
    sport: 'football',
    league: 'Bundesliga',
    channel: 'SportyLive 2 HD',
  },
  {
    slot: 'scheduled',
    offsetHours: 7,
    homeTeam: 'Man Utd',
    awayTeam: 'Liverpool',
    sport: 'football',
    league: 'Premier League',
    channel: 'Sky Sports PL',
  },
  {
    slot: 'scheduled',
    offsetHours: 26,
    homeTeam: 'Fury',
    awayTeam: 'Usyk',
    sport: 'boxing',
    league: 'Heavyweight Title',
    channel: 'Boxing PPV',
  },
  {
    slot: 'scheduled',
    offsetHours: 31,
    homeTeam: 'Red Bull',
    awayTeam: 'Ferrari',
    sport: 'f1',
    league: 'Abu Dhabi Grand Prix',
    channel: 'F1 Live',
  },
];

const pad = (value: number) => String(value).padStart(2, '0');

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Build the eight demo fixtures, anchored to `now`. */
export function buildSeedUpcomingEvents(now = new Date()): AdminUpcomingEvent[] {
  return SEED_FIXTURES.map((fixture, index) => {
    const kickoff = new Date(now.getTime() + fixture.offsetHours * 60 * 60 * 1000);
    return {
      id: `seed-${fixture.slot}-${index + 1}`,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      sport: fixture.sport,
      league: fixture.league,
      channel: fixture.channel,
      dateKey: toDateKey(kickoff),
      time: toTime(kickoff),
      streamUrl: fixture.streamUrl,
      headers: {},
      status: fixture.slot === 'upcoming' ? 'upcoming' : 'scheduled',
      enabled: true,
    };
  });
}
