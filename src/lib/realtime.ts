/**
 * Realtime store updates over server-sent events.
 *
 * `GET /api/events` pushes a `change` frame whenever the admin store commits
 * (Neon revision bump or local JSON write), so the web app refetches within a
 * second instead of polling on a timer.
 */

export interface StoreRevisionEvent {
  revision: number;
  backend?: 'neon' | 'json';
  at?: string;
}

interface SubscribeOptions {
  /** Called after a change settles (bursts of writes are coalesced). */
  onChange: (event: StoreRevisionEvent) => void;
  /** Called with true on connect and false when the stream drops. */
  onStatus?: (connected: boolean) => void;
  /** Quiet period before a change is delivered, in ms. */
  settleMs?: number;
}

export function subscribeStoreChanges({
  onChange,
  onStatus,
  settleMs = 400,
}: SubscribeOptions): () => void {
  if (typeof window === 'undefined' || !('EventSource' in window)) {
    return () => {};
  }

  let source: EventSource | null = null;
  let closed = false;
  let settleTimer: number | null = null;
  let pending: StoreRevisionEvent | null = null;

  const flush = () => {
    settleTimer = null;
    const event = pending;
    pending = null;
    if (!event || closed) return;
    try {
      onChange(event);
    } catch (err) {
      console.error('[realtime] change handler failed', err);
    }
  };

  const handleChange = (raw: string) => {
    let event: StoreRevisionEvent = { revision: 0 };
    try {
      event = JSON.parse(raw || '{}') as StoreRevisionEvent;
    } catch {
      /* keep the default; a malformed frame still deserves a refetch */
    }
    pending = event;
    if (settleTimer !== null) window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(flush, settleMs);
  };

  try {
    source = new EventSource('/api/events');
  } catch {
    return () => {};
  }

  const stream = source;
  stream.addEventListener('open', () => onStatus?.(true));
  stream.addEventListener('error', () => {
    // The browser reconnects on its own (the server sends `retry: 3000`);
    // report the gap so callers can show a "reconnecting" state.
    onStatus?.(false);
  });
  stream.addEventListener('ready', (frame) => {
    const raw = (frame as MessageEvent).data as string;
    let event: StoreRevisionEvent | null = null;
    try {
      event = JSON.parse(raw || '{}') as StoreRevisionEvent;
    } catch {
      event = null;
    }
    onStatus?.(true);
    // Catch up on whatever changed while the tab was closed/offline.
    if (event?.revision) handleChange(raw);
  });
  stream.addEventListener('change', (frame) => handleChange((frame as MessageEvent).data as string));

  return () => {
    closed = true;
    if (settleTimer !== null) window.clearTimeout(settleTimer);
    stream.close();
    source = null;
  };
}
