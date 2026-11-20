import {
  AdminBanner,
  AdminLiveEvent,
  AdminUpcomingEvent,
  AppData,
  IptvChannel,
  IptvPlaylist,
  SiteSettings,
  StreamHeaders,
} from '../types/iptv';

async function j<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Bad server response (${res.status})`);
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/admin/login')) {
        window.location.href = '/admin/login';
      }
    }
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return body as T;
}

export const TOKEN_KEY = 'sportylive_admin_token';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function adminLogin(username: string, password: string): Promise<{ token: string }> {
  return fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).then((r) => j<{ token: string }>(r));
}

export function fetchAppData(): Promise<AppData> {
  return fetch('/api/data', { cache: 'no-store' }).then((r) => j<AppData>(r));
}

/** Admin view of app data, including channels from disabled playlists. */
export function fetchAdminAppData(): Promise<AppData> {
  return fetch('/api/admin/data', {
    headers: authHeaders(),
    cache: 'no-store',
  }).then((r) => j<AppData>(r));
}

/* ---------------- Playlists ---------------- */

export interface ImportResponse {
  playlist: IptvPlaylist;
  channelCount: number;
  sample: string[];
  groups?: string[];
}

export function importPlaylist(payload: {
  name: string;
  url?: string;
  content?: string;
}): Promise<ImportResponse> {
  return fetch('/api/admin/playlists', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }).then((r) => j<ImportResponse>(r));
}

export function refreshPlaylist(id: string): Promise<SyncStats & { channelCount: number }> {
  return fetch(`/api/admin/playlists/${id}/refresh`, {
    method: 'POST',
    headers: authHeaders(),
  }).then((r) => j<SyncStats & { channelCount: number }>(r));
}

export interface SyncStats {
  added: number;
  updated: number;
  removed: number;
}

export function syncPlaylist(id: string): Promise<SyncStats & { channelCount: number }> {
  return fetch(`/api/admin/playlists/${id}/sync`, {
    method: 'POST',
    headers: authHeaders(),
  }).then((r) => j<SyncStats & { channelCount: number }>(r));
}

export function updatePlaylist(
  id: string,
  patch: { autoSync?: boolean; enabled?: boolean; name?: string }
): Promise<void> {
  return fetch(`/api/admin/playlists/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  }).then((r) => j<void>(r));
}

export function deletePlaylist(id: string): Promise<void> {
  return fetch(`/api/admin/playlists/${id}`, { method: 'DELETE', headers: authHeaders() }).then(
    (r) => j<void>(r)
  );
}

/* ---------------- Channels ---------------- */

export function patchChannel(
  id: string,
  patch: Partial<Pick<IptvChannel, 'sport' | 'shelf' | 'quality' | 'enabled' | 'name' | 'headers'>>
): Promise<IptvChannel> {
  return fetch(`/api/admin/channels/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  }).then((r) => j<IptvChannel>(r));
}

export function deleteChannel(id: string): Promise<void> {
  return fetch(`/api/admin/channels/${id}`, { method: 'DELETE', headers: authHeaders() }).then(
    (r) => j<void>(r)
  );
}

export interface TestStreamResult {
  finalStatus: number;
  contentType?: string;
  isHlsPlaylist: boolean;
  userAgentSent: string;
  refererSent: string;
}

export function testStream(url: string, headers: StreamHeaders): Promise<TestStreamResult> {
  const params = new URLSearchParams({
    u: btoa(unescape(encodeURIComponent(url))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    h: btoa(unescape(encodeURIComponent(JSON.stringify(headers ?? {}))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  });
  return fetch(`/api/admin/test-stream?${params}`, { headers: authHeaders() }).then((r) =>
    j<TestStreamResult>(r)
  );
}

/* ---------------- Events ---------------- */

export function createEvent(
  payload: Partial<AdminLiveEvent & AdminUpcomingEvent> & { kind: 'live' | 'upcoming' }
): Promise<AdminLiveEvent | AdminUpcomingEvent> {
  return fetch('/api/admin/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }).then((r) => j<AdminLiveEvent | AdminUpcomingEvent>(r));
}

export function updateEvent(
  id: string,
  patch: Record<string, unknown>
): Promise<AdminLiveEvent | AdminUpcomingEvent> {
  return fetch(`/api/admin/events/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  }).then((r) => j<AdminLiveEvent | AdminUpcomingEvent>(r));
}

export function deleteEvent(id: string): Promise<void> {
  return fetch(`/api/admin/events/${id}`, { method: 'DELETE', headers: authHeaders() }).then(
    (r) => j<void>(r)
  );
}

/* ---------------- Banners ---------------- */

export function createBanner(payload: Partial<AdminBanner>): Promise<AdminBanner> {
  return fetch('/api/admin/banners', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }).then((r) => j<AdminBanner>(r));
}

export function updateBanner(id: string, patch: Record<string, unknown>): Promise<AdminBanner> {
  return fetch(`/api/admin/banners/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  }).then((r) => j<AdminBanner>(r));
}

export function deleteBanner(id: string): Promise<void> {
  return fetch(`/api/admin/banners/${id}`, { method: 'DELETE', headers: authHeaders() }).then(
    (r) => j<void>(r)
  );
}

/* ---------------- Web push ---------------- */

export interface PushPrefs {
  newEvents: boolean;
  syncErrors: boolean;
  syncChanges: boolean;
}

export interface PushConfig {
  publicKey: string;
  prefs: PushPrefs;
  subscriptions: number;
}

export interface PushResult {
  sent: number;
  failed: number;
  removed: number;
  configured: boolean;
}

export function fetchPushConfig(): Promise<PushConfig> {
  return fetch('/api/admin/push/config', { headers: authHeaders(), cache: 'no-store' }).then((r) =>
    j<PushConfig>(r)
  );
}

export function subscribePush(sub: PushSubscriptionJSON): Promise<{ subscriptions: number }> {
  return fetch('/api/admin/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(sub),
  }).then((r) => j<{ subscriptions: number }>(r));
}

export function unsubscribePush(endpoint: string): Promise<{ subscriptions: number }> {
  return fetch('/api/admin/push/unsubscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ endpoint }),
  }).then((r) => j<{ subscriptions: number }>(r));
}

export function sendTestPush(): Promise<PushResult> {
  return fetch('/api/admin/push/test', {
    method: 'POST',
    headers: authHeaders(),
  }).then((r) => j<PushResult>(r));
}

export function updatePushPrefs(patch: Partial<PushPrefs>): Promise<PushPrefs> {
  return fetch('/api/admin/push/prefs', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  }).then((r) => j<PushPrefs>(r));
}

/* ---------------- Site settings ---------------- */

export function fetchSettings(): Promise<SiteSettings> {
  return fetch('/api/admin/settings', { headers: authHeaders(), cache: 'no-store' }).then((r) =>
    j<SiteSettings>(r)
  );
}

export function updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  return fetch('/api/admin/settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  }).then((r) => j<SiteSettings>(r));
}
