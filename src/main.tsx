import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {initOneSignal} from './lib/onesignal.ts';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// OneSignal web push (viewer broadcasts) — no-op unless configured.
const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
if (idle) {
  idle(() => void initOneSignal());
} else {
  window.setTimeout(() => void initOneSignal(), 2000);
}
