import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {initOneSignal} from './lib/onesignal.ts';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// OneSignal web push (viewer broadcasts) — no-op unless configured.
// Also warm the hls.js chunk while the shell is idle, so the first time a
// viewer opens a stream the player isn't waiting on the module download.
const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
const warmWhenIdle = (cb: () => void) => {
  if (idle) idle(cb);
  else window.setTimeout(cb, 2000);
};
warmWhenIdle(() => void import('hls.js').catch(() => undefined));
warmWhenIdle(() => void initOneSignal());
