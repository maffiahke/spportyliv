import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  BellOff,
  CheckCircle2,
  Info,
  Lock,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { PushPrefs } from '../../types/iptv';
import {
  fetchPushConfig,
  getAdminToken,
  PushConfig,
  sendTestPush,
  updatePushPrefs,
} from '../../lib/api';
import {
  currentSubscription,
  disableAdminPush,
  enableAdminPush,
  notificationPermission,
  pushSupport,
} from '../../lib/push';
import { NeonToggle, Spinner } from './ui';

interface NotificationsTabProps {
  onToast: (msg: string, error?: boolean) => void;
}

const PrefRow: React.FC<{
  icon: React.ElementType;
  title: string;
  hint: string;
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}> = ({ icon: Icon, title, hint, on, disabled, onChange }) => (
  <div className="flex items-center gap-3 rounded-xl border border-white/70 bg-[#F4F8FF] px-3 py-2.5">
    <span className="w-8 h-8 rounded-lg neu-inset-sm flex items-center justify-center text-[#1D6BFF] shrink-0">
      <Icon className="w-4 h-4" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="font-display font-bold text-[11.5px] text-slate-900">{title}</p>
      <p className="text-[10px] text-slate-500 leading-snug">{hint}</p>
    </div>
    <NeonToggle on={on} onChange={onChange} label={title} />
  </div>
);

export const NotificationsTab: React.FC<NotificationsTabProps> = ({ onToast }) => {
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [thisDevice, setThisDevice] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [support, setSupport] = useState<'supported' | 'insecure' | 'unsupported'>('unsupported');

  const refresh = useCallback(async () => {
    try {
      const cfg = await fetchPushConfig();
      setConfig(cfg);
      const sub = await currentSubscription();
      setThisDevice(!!sub);
    } catch {
      /* keep last state */
    }
    setPermission(notificationPermission());
    setSupport(pushSupport());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await enableAdminPush(config ?? undefined);
      if (result.status === 'subscribed') {
        onToast(`Push notifications enabled on this device (${result.subscriptions} total)`);
      } else if (result.status === 'denied') {
        onToast('Notification permission was blocked — allow it in your browser settings', true);
      } else {
        onToast(result.reason, true);
      }
      await refresh();
    } catch (err) {
      onToast(`Could not enable push: ${(err as Error).message}`, true);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const remaining = await disableAdminPush();
      onToast(`Push notifications disabled on this device (${remaining} remaining)`);
      await refresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const res = await sendTestPush();
      if (res.sent > 0) {
        onToast(`Test sent to ${res.sent} device${res.sent === 1 ? '' : 's'}`);
      } else if (!res.configured) {
        onToast('No subscribed devices yet — enable notifications first', true);
      } else {
        onToast(`Test failed (${res.failed}) — expired subscriptions were pruned`, true);
      }
      await refresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setTesting(false);
    }
  };

  const setPref = async (key: keyof PushPrefs, value: boolean) => {
    const prev = config;
    if (!config) return;
    setConfig({ ...config, prefs: { ...config.prefs, [key]: value } });
    try {
      const prefs = await updatePushPrefs({ [key]: value } as Partial<PushPrefs>);
      setConfig({ ...config, prefs });
    } catch (err) {
      setConfig(prev);
      onToast((err as Error).message, true);
    }
  };

  if (!getAdminToken()) {
    return (
      <div className="neon-card p-6 text-center text-xs text-slate-500">
        Sign in to manage push notifications.
      </div>
    );
  }

  const subscribed = config?.subscriptions ?? 0;
  const enabledHere = thisDevice && permission === 'granted';

  return (
    <div className="space-y-4">
      {/* Status */}
      <section className="neon-card neon-card-accent p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br ${
                enabledHere ? 'from-[#0D9488] to-[#34D399]' : 'from-[#1D6BFF] to-[#7C3AED]'
              } shadow-[4px_4px_12px_rgba(29,107,255,0.3)]`}
            >
              {enabledHere ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </span>
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-sm text-slate-950">
                Browser Push Notifications
              </h2>
              <p className="text-[11px] text-slate-500">
                {enabledHere
                  ? 'This device receives admin alerts.'
                  : 'Enable alerts for this browser — no app install required.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {enabledHere ? (
              <button
                type="button"
                onClick={disable}
                disabled={busy}
                className="neon-btn-ghost px-3.5 py-2 text-[11px] disabled:opacity-50"
              >
                {busy ? <Spinner /> : <BellOff className="w-3.5 h-3.5" />}
                Disable on this device
              </button>
            ) : (
              <button
                type="button"
                onClick={enable}
                disabled={busy || support !== 'supported'}
                className="neon-btn-accent px-4 py-2 text-[11px] disabled:opacity-50"
              >
                {busy ? <Spinner /> : <BellRing className="w-3.5 h-3.5" />}
                Enable notifications
              </button>
            )}
            <button
              type="button"
              onClick={test}
              disabled={testing}
              className="neon-btn px-3.5 py-2 text-[11px] disabled:opacity-50"
            >
              {testing ? <Spinner /> : <Send className="w-3.5 h-3.5" />}
              Send test
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`neon-badge ${enabledHere ? '' : 'opacity-70'}`}>
            {enabledHere ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                This device subscribed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <BellOff className="w-3 h-3" />
                This device not subscribed
              </span>
            )}
          </span>
          <span className="neon-badge">
            <span className="inline-flex items-center gap-1">
              <Smartphone className="w-3 h-3" />
              {subscribed} subscribed device{subscribed === 1 ? '' : 's'}
            </span>
          </span>
          <span className="neon-badge">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Permission: {permission}
            </span>
          </span>
        </div>

        {support === 'insecure' && (
          <p className="flex items-start gap-2 rounded-xl bg-[#FFF7E6] border border-[#FDE68A] px-3 py-2 text-[11px] text-[#92400E]">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Web push needs a secure context. Use <strong>https</strong> (or open the admin on
            localhost) — on plain http to a LAN IP browsers disable notifications.
          </p>
        )}
        {support === 'unsupported' && (
          <p className="flex items-start gap-2 rounded-xl bg-[#FDECEF] border border-[#FECDD8] px-3 py-2 text-[11px] text-[#B91C1C]">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            This browser does not expose the Push API. Try Chrome, Edge, Firefox, or installed
            Safari on iOS 16.4+.
          </p>
        )}
        {permission === 'denied' && (
          <p className="flex items-start gap-2 rounded-xl bg-[#FDECEF] border border-[#FECDD8] px-3 py-2 text-[11px] text-[#B91C1C]">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Notifications are blocked for this site. Open the browser's site settings, allow
            notifications, then reload this page.
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Preferences */}
        <section className="neon-card p-4 sm:p-5 xl:col-span-7 space-y-3">
          <h3 className="font-display font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-[#1D6BFF]" />
            Alert Preferences
          </h3>
          <PrefRow
            icon={Radio}
            title="New live events & fixtures"
            hint="Fire when you publish a live event or schedule a fixture."
            on={config?.prefs.newEvents ?? true}
            onChange={(v) => setPref('newEvents', v)}
          />
          <PrefRow
            icon={AlertTriangle}
            title="Playlist sync failures"
            hint="Fire when an auto-sync or manual sync errors out."
            on={config?.prefs.syncErrors ?? true}
            onChange={(v) => setPref('syncErrors', v)}
          />
          <PrefRow
            icon={RefreshCw}
            title="Playlist content changes"
            hint="Fire when a sync adds or removes channels."
            on={config?.prefs.syncChanges ?? false}
            onChange={(v) => setPref('syncChanges', v)}
          />
          <p className="text-[10px] text-slate-500">
            Preferences apply to every subscribed device. Use “Send test” to confirm delivery.
          </p>
        </section>

        {/* How it works */}
        <section className="neon-card p-4 sm:p-5 xl:col-span-5 space-y-2.5">
          <h3 className="font-display font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-[#1D6BFF]" />
            How it works
          </h3>
          <ul className="space-y-2 text-[11px] text-slate-600 leading-relaxed">
            <li>• Notifications arrive even when the admin tab is closed (browser running).</li>
            <li>• Each browser/device subscribes separately — enable it on every device you use.</li>
            <li>• Clicking a notification focuses the admin console.</li>
            <li>• Expired subscriptions are removed automatically after a failed delivery.</li>
            <li>• VAPID keys live in the server store, so restarts keep existing subscriptions valid.</li>
          </ul>
          <div className="rounded-xl border border-white/70 bg-[#F4F8FF] px-3 py-2 text-[10.5px] text-slate-500">
            Server endpoint: <code className="font-mono">/api/admin/push/*</code> · worker:{' '}
            <code className="font-mono">/admin-sw.js</code>
          </div>
        </section>
      </div>
    </div>
  );
};
