import { StreamHeaders } from '../types/iptv';

/**
 * Full-featured M3U / M3U8 playlist parser for IPTV.
 *
 * Understands per-channel directives commonly used by IPTV providers:
 *  - `#EXTINF:<duration> attrs,Display Name` (tvg-id, tvg-name, tvg-logo, group-title, ...)
 *  - `#EXTGRP:<group>`
 *  - `#EXTVLCOPT:http-user-agent=...` / `#EXTVLCOPT:http-referrer=...`
 *  - `#EXTHTTP:{"User-Agent":"...","Referer":"...",...}`
 *  - `#KODIPROP:inputstream.adaptive.stream_headers=...` (URL-encoded User-Agent/Referer)
 *  - Headers embedded in the stream URL query (`?ua=`, `?user_agent=`, `?referer=`, ...)
 */
export interface ParsedChannel {
  name: string;
  url: string;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  group?: string;
  headers: StreamHeaders;
}

const ATTR_RE = /([A-Za-z0-9_-]+)="([^"]*)"/g;

/** Map arbitrary header keys into our normalized StreamHeaders shape. */
function normalizeHeaderMap(raw: Record<string, string>): StreamHeaders {
  const out: StreamHeaders = { extra: {} };
  for (const [key, value] of Object.entries(raw)) {
    const k = key.toLowerCase();
    if (k === 'user-agent') out.userAgent = value;
    else if (k === 'referer' || k === 'referrer') out.referer = value;
    else if (k === 'origin') out.origin = value;
    else if (k === 'cookie') out.cookies = value;
    else if (value) {
      out.extra = out.extra ?? {};
      out.extra[k] = value;
    }
  }
  if (out.extra && Object.keys(out.extra).length === 0) delete out.extra;
  return out;
}

/** Extract headers embedded as query params on the stream URL itself. */
function headersFromUrlQuery(url: string): StreamHeaders {
  const out: StreamHeaders = { extra: {} };
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return out;
  const params = new URLSearchParams(url.slice(qIdx + 1));
  const grab = (...names: string[]): string | undefined => {
    for (const n of names) {
      const v = params.get(n);
      if (v) return v;
    }
    return undefined;
  };
  const ua = grab('ua', 'user_agent', 'user-agent', 'useragent');
  const ref = grab('referer', 'referrer', 'ref');
  const origin = grab('origin');
  if (ua) out.userAgent = ua;
  if (ref) out.referer = ref;
  if (origin) out.origin = origin;
  if (out.extra && Object.keys(out.extra).length === 0) delete out.extra;
  return out;
}

/** Parse `#KODIPROP:inputstream.adaptive.stream_headers=...` style props. */
function headersFromKodiProp(value: string): StreamHeaders {
  const out: StreamHeaders = { extra: {} };
  // value may be a raw urlencoded query string of headers
  const raw = value.includes('stream_headers=')
    ? value.split('stream_headers=')[1] ?? ''
    : value;
  try {
    const params = new URLSearchParams(decodeURIComponent(raw));
    const ua = params.get('User-Agent');
    const ref = params.get('Referer') ?? params.get('Referrer');
    const origin = params.get('Origin');
    if (ua) out.userAgent = ua;
    if (ref) out.referer = ref;
    if (origin) out.origin = origin;
  } catch {
    /* ignore malformed props */
  }
  if (out.extra && Object.keys(out.extra).length === 0) delete out.extra;
  return out;
}

function mergeHeaders(...parts: StreamHeaders[]): StreamHeaders {
  const out: StreamHeaders = {};
  for (const part of parts) {
    if (!part) continue;
    if (part.userAgent) out.userAgent = part.userAgent;
    if (part.referer) out.referer = part.referer;
    if (part.origin) out.origin = out.origin ?? part.origin;
    if (part.cookies) out.cookies = out.cookies ?? part.cookies;
    if (part.extra) out.extra = { ...part.extra, ...out.extra };
  }
  return out;
}

/** Parse the full text of an M3U/M3U8 playlist into channel entries. */
export function parseM3U(content: string): ParsedChannel[] {
  const channels: ParsedChannel[] = [];
  const lines = content.split(/\r?\n/);

  let pending: {
    attrs: Record<string, string>;
    title?: string;
    headers: StreamHeaders;
    group?: string;
  } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) continue;

    if (line.startsWith('#EXTINF')) {
      const commaIdx = line.indexOf(',');
      const meta = commaIdx >= 0 ? line.slice(0, commaIdx) : line;
      const display = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';
      const attrs: Record<string, string> = {};
      let m: RegExpExecArray | null;
      ATTR_RE.lastIndex = 0;
      while ((m = ATTR_RE.exec(meta))) {
        attrs[m[1].toLowerCase()] = m[2];
      }
      pending = {
        attrs,
        title: display || attrs['tvg-name'] || '',
        headers: {},
        group: attrs['group-title'] || undefined,
      };
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      if (pending) pending.group = line.slice(8).trim() || pending.group;
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:')) {
      const opt = line.slice(11).trim();
      const eq = opt.indexOf('=');
      if (eq > 0 && pending) {
        const key = opt.slice(0, eq).trim().toLowerCase();
        const val = opt.slice(eq + 1).trim();
        if (key === 'http-user-agent') pending.headers.userAgent = val;
        else if (key === 'http-referrer') pending.headers.referer = val;
        else if (key === 'http-origin') pending.headers.origin = val;
        else if (key === 'http-cookies') pending.headers.cookies = val;
      }
      continue;
    }

    if (line.startsWith('#EXTHTTP:')) {
      try {
        const raw = JSON.parse(line.slice(9).trim()) as Record<string, string>;
        if (pending) pending.headers = mergeHeaders(pending.headers, normalizeHeaderMap(raw));
      } catch {
        /* ignore malformed #EXTHTTP */
      }
      continue;
    }

    if (line.startsWith('#KODIPROP:')) {
      const prop = line.slice(10).trim();
      if (prop.includes('stream_headers') && pending) {
        pending.headers = mergeHeaders(pending.headers, headersFromKodiProp(prop));
      }
      continue;
    }

    if (line.startsWith('#')) continue; // any other directive/comment

    // Non-directive line => stream URI
    const url = line;
    const urlHeaders = headersFromUrlQuery(url);
    const entry: ParsedChannel = {
      name: pending?.title || url.split('/').pop() || url,
      url,
      tvgId: pending?.attrs['tvg-id'],
      tvgName: pending?.attrs['tvg-name'],
      tvgLogo: pending?.attrs['tvg-logo'],
      group: pending?.group,
      headers: mergeHeaders(pending?.headers ?? {}, urlHeaders),
    };
    channels.push(entry);
    pending = null;
  }

  return channels;
}

const SPORT_KEYWORDS: Array<[RegExp, string]> = [
  [/foot|soccer|calcio|fussball|laliga|la ?liga|premier|serie ?a|bundes|ligue ?1|mls|champions/i, 'football'],
  [/basket|nba|ncaa|hoop/i, 'basketball'],
  [/tennis|atp|wta|wimbledon|us ?open/i, 'tennis'],
  [/box|wwe|fight|ppv|bellator/i, 'boxing'],
  [/f1|formula|motogp|motor|nascar|racing|gp\b/i, 'f1'],
  [/cricket|ipl|willow/i, 'cricket'],
  [/mma|ufc|mixed martial/i, 'mma'],
  [/golf|pga|masters/i, 'golf'],
];

/** Best-effort sport classification from a channel name / group title. */
export function guessSport(name: string, group?: string): string {
  const text = `${group ?? ''} ${name}`;
  for (const [re, sport] of SPORT_KEYWORDS) {
    if (re.test(text)) return sport;
  }
  return 'other';
}

/** Derive a short channel code for badge display. */
export function shortCode(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase() + (words[1][1] ?? '').toUpperCase();
  return cleaned.slice(0, 3).toUpperCase() || 'TV';
}
