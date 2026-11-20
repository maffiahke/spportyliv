import { StreamHeaders } from '../types/iptv';

/** Base64url encode that works in both browser and Node. */
function b64urlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  if (typeof btoa === 'function') {
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // Node fallback
  return Buffer.from(input, 'utf-8').toString('base64url');
}

/** Build a proxy URL that carries the stream URL + its required headers. */
export function buildProxiedUrl(
  url: string,
  headers?: StreamHeaders,
  forceHls?: boolean
): string {
  const u = b64urlEncode(url);
  const h = b64urlEncode(JSON.stringify(headers ?? {}));
  // `f` tells the player the upstream format when the proxy URL can't reveal it.
  const f = (forceHls ?? isHlsUrl(url)) ? '&f=m3u8' : '';
  return `/api/iptv/stream?u=${u}&h=${h}${f}`;
}

/** True when a raw URL is an HLS playlist. */
export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url);
}

/**
 * True when the given playback URL needs hls.js — covers both raw .m3u8 URLs
 * and proxied URLs carrying the f=m3u8 format flag.
 */
export function isHlsPlaybackUrl(url: string): boolean {
  if (isHlsUrl(url)) return true;
  const qIdx = url.indexOf('?');
  if (qIdx === -1 || !url.startsWith('/api/iptv/stream')) return false;
  return new URLSearchParams(url.slice(qIdx + 1)).get('f') === 'm3u8';
}
