import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  ExternalLink,
  Loader2,
  LogIn,
  LogOut,
  Shield,
  Tv,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { UpcomingEvent } from '../types/sports';
import type { AdsSettings } from '../types/iptv';
import type { AppUser, AuthCredentials, SignUpCredentials } from '../types/user';
import { COUNTRIES, findCountry } from '../data/countries';
import { AdSlot } from './ads/AdSlot';

interface ProfileViewProps {
  notifiedEvents: UpcomingEvent[];
  onRemoveReminder: (event: UpcomingEvent) => void;
  user: AppUser | null;
  authLoading?: boolean;
  onSignIn: (credentials: AuthCredentials) => Promise<void>;
  onSignUp: (credentials: SignUpCredentials) => Promise<void>;
  onSignOut: () => Promise<void> | void;
  ads?: AdsSettings | null;
}

const TelegramIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M21.94 3.46a1.25 1.25 0 0 0-1.3-.21L2.63 10.4a1.25 1.25 0 0 0 .08 2.34l4.53 1.48 1.72 5.41a1.2 1.2 0 0 0 2.02.45l2.58-2.66 4.74 3.49a1.25 1.25 0 0 0 1.97-.76l2.9-14.95a1.25 1.25 0 0 0-.23-.34ZM9.74 14.37l-.57 3.04-1.08-3.4 9.57-6.37-7.92 6.73Z" />
  </svg>
);

const COUNTRY_OPTIONS = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));

export const ProfileView: React.FC<ProfileViewProps> = ({
  notifiedEvents,
  onRemoveReminder,
  user,
  authLoading = false,
  onSignIn,
  onSignUp,
  onSignOut,
  ads,
}) => {
  const [defaultQuality, setDefaultQuality] = useState<'Auto' | '4K' | 'HD'>('4K');
  const [pushGoals, setPushGoals] = useState(true);
  const [favoriteSports, setFavoriteSports] = useState<string[]>([
    'Football',
    'Formula 1',
    'Basketball',
  ]);

  // Account form state
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setPassword('');
      setAuthError(null);
    }
  }, [user]);

  const countryInfo = user ? findCountry(user.country) : undefined;
  const memberSince = useMemo(() => {
    if (!user) return '';
    const date = new Date(user.createdAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }, [user]);

  const toggleSport = (sport: string) => {
    setFavoriteSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  };

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setAuthError(null);
  };

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setAuthError('Enter a username.');
      return;
    }
    if (!password) {
      setAuthError('Enter a password.');
      return;
    }
    if (mode === 'signup' && !country) {
      setAuthError('Please choose your country.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await onSignIn({ username: trimmedUsername, password });
      } else {
        await onSignUp({ username: trimmedUsername, password, country });
      }
      setPassword('');
    } catch (err) {
      setAuthError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Neumorphic Member / Guest Card */}
      <div className="neu-surface rounded-[24px] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="neu-inset w-15 h-15 rounded-full p-1.5 flex items-center justify-center shrink-0">
            <div
              className={`w-full h-full rounded-full text-white flex items-center justify-center shadow-sm ${
                user
                  ? 'bg-gradient-to-br from-[#1D6BFF] to-[#1E40AF]'
                  : 'bg-gradient-to-br from-slate-400 to-slate-600'
              }`}
            >
              {user ? (
                <span className="font-display font-extrabold text-xl uppercase">
                  {user.username.charAt(0)}
                </span>
              ) : (
                <User className="w-6 h-6" />
              )}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-lg text-slate-950 truncate">
              {user ? user.username : 'Guest User'}
            </h1>
            <p className="text-xs text-slate-600 truncate">
              {user
                ? `${countryInfo?.flag ?? '🌍'} ${user.countryName}${
                    memberSince ? ` · Member since ${memberSince}` : ''
                  }`
                : 'Sign in to save reminders and sync your preferences'}
            </p>
          </div>
        </div>

        {user ? (
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="neu-inset-sm inline-flex items-center gap-1 rounded-full text-[#1D6BFF] px-3 py-1.5 text-xs font-display font-bold">
              <Shield className="w-3.5 h-3.5" />
              Active
            </span>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-rose-600 px-2 py-1 rounded-full cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        ) : (
          <span className="neu-inset-sm inline-flex items-center gap-1 rounded-full text-slate-600 px-3 py-1.5 text-xs font-display font-bold shrink-0">
            <User className="w-3.5 h-3.5" />
            Guest
          </span>
        )}
      </div>

      {/* Account access — only for guests */}
      {!user && (
        <section aria-label="Account access" className="neu-surface rounded-[24px] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="neu-inset-sm w-10 h-10 rounded-full p-1 flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#1D6BFF] to-[#1E40AF] text-white flex items-center justify-center shadow-sm">
                {mode === 'signin' ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-extrabold text-base text-slate-950">
                {mode === 'signin' ? 'Sign in to SportyLive' : 'Create your account'}
              </h2>
              <p className="text-xs text-slate-600 truncate">
                Pick a username, password and your country
              </p>
            </div>
          </div>

          {authLoading ? (
            <div className="neu-inset-sm rounded-2xl p-4 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking your session…
            </div>
          ) : (
            <>
              <div className="neu-inset rounded-2xl p-1.5 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  aria-pressed={mode === 'signin'}
                  className={`py-2 rounded-xl text-xs font-display font-bold cursor-pointer transition-all ${
                    mode === 'signin'
                      ? 'neu-surface-sm text-[#1D6BFF]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  aria-pressed={mode === 'signup'}
                  className={`py-2 rounded-xl text-xs font-display font-bold cursor-pointer transition-all ${
                    mode === 'signup'
                      ? 'neu-surface-sm text-[#1D6BFF]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Create account
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="profile-username"
                    className="block text-xs font-semibold text-slate-600 mb-1.5"
                  >
                    Username
                  </label>
                  <input
                    id="profile-username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. matchday_king"
                    maxLength={24}
                    className="neu-inset w-full rounded-2xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6BFF]/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="profile-password"
                    className="block text-xs font-semibold text-slate-600 mb-1.5"
                  >
                    Password
                  </label>
                  <input
                    id="profile-password"
                    type="password"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                    maxLength={128}
                    className="neu-inset w-full rounded-2xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6BFF]/40"
                  />
                </div>

                {mode === 'signup' && (
                  <div>
                    <label
                      htmlFor="profile-country"
                      className="block text-xs font-semibold text-slate-600 mb-1.5"
                    >
                      Country
                    </label>
                    <select
                      id="profile-country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      autoComplete="country"
                      className="neu-inset w-full rounded-2xl px-4 py-2.5 text-sm text-slate-900 bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6BFF]/40 cursor-pointer"
                    >
                      <option value="">Select your country</option>
                      {COUNTRY_OPTIONS.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.flag} {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {authError && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-2xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                    <span>{authError}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#1D6BFF] to-[#1E40AF] text-white font-display font-bold text-sm py-3 shadow-sm transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : mode === 'signin' ? (
                    <LogIn className="w-4 h-4" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  {submitting
                    ? mode === 'signin'
                      ? 'Signing in…'
                      : 'Creating account…'
                    : mode === 'signin'
                      ? 'Sign in'
                      : 'Create account'}
                </button>

                <p className="text-[11px] text-center text-slate-500">
                  {mode === 'signin'
                    ? 'New to SportyLive? Switch to Create account above.'
                    : 'Your account keeps your reminders and preferences in sync.'}
                </p>
              </form>
            </>
          )}
        </section>
      )}

      {/* Telegram Channel & Group Community Card */}
      <section aria-label="Telegram community" className="neu-surface rounded-[24px] p-5 space-y-3.5">
        <div className="flex items-center gap-3">
          <div className="neu-inset-sm w-10 h-10 rounded-full p-1 flex items-center justify-center shrink-0">
            <div className="w-full h-full rounded-full bg-gradient-to-br from-[#2AABEE] to-[#229ED9] text-white flex items-center justify-center shadow-sm">
              <TelegramIcon className="w-4 h-4 -ml-0.5" />
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-extrabold text-base text-slate-950">
              Join Us on Telegram
            </h2>
            <p className="text-xs text-slate-600 truncate">
              Get instant stream links, alerts &amp; matchday chat
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="https://t.me/sportylive_channel"
            target="_blank"
            rel="noopener noreferrer"
            className="neu-surface-sm neu-pressable rounded-[18px] p-3.5 flex items-center justify-between gap-3 transition-all hover:-translate-y-0.5 min-h-[64px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="neu-inset-sm w-11 h-11 rounded-full p-1 flex items-center justify-center shrink-0">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#2AABEE] to-[#229ED9] text-white flex items-center justify-center">
                  <TelegramIcon className="w-4 h-4 -ml-0.5" />
                </div>
              </div>
              <div className="min-w-0">
                <span className="block font-display font-bold text-sm text-slate-950 truncate">
                  Telegram Channel
                </span>
                <span className="block text-[11px] font-medium text-slate-600 truncate">
                  Live links &amp; match alerts
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#229ED9] text-white px-3.5 py-1.5 text-xs font-display font-bold whitespace-nowrap shrink-0 shadow-sm">
              <span>Join</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </a>

          <a
            href="https://t.me/sportylive_group"
            target="_blank"
            rel="noopener noreferrer"
            className="neu-surface-sm neu-pressable rounded-[18px] p-3.5 flex items-center justify-between gap-3 transition-all hover:-translate-y-0.5 min-h-[64px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="neu-inset-sm w-11 h-11 rounded-full p-1 flex items-center justify-center shrink-0">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#1D6BFF] to-[#229ED9] text-white flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="min-w-0">
                <span className="block font-display font-bold text-sm text-slate-950 truncate">
                  Telegram Group
                </span>
                <span className="block text-[11px] font-medium text-slate-600 truncate">
                  Fan chat &amp; stream requests
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#229ED9] text-white px-3.5 py-1.5 text-xs font-display font-bold whitespace-nowrap shrink-0 shadow-sm">
              <span>Join</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </a>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:items-start">
        {/* Saved Match Reminders */}
        <section className="neu-surface rounded-[24px] p-5 space-y-3 lg:col-span-7 xl:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-slate-950 flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#1D6BFF]" />
              Match Reminders ({notifiedEvents.length})
            </h2>
          </div>

          {notifiedEvents.length === 0 ? (
            <div className="neu-inset-sm rounded-2xl p-4">
              <p className="text-xs text-slate-500">
                Tap the bell icon on any upcoming match to save kickoff alerts here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifiedEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="neu-inset-sm flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-display font-bold text-xs text-slate-900 truncate">
                      {ev.homeTeam} vs {ev.awayTeam}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {ev.dayOfWeek} {ev.dayNumber} {ev.month} · {ev.time}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveReminder(ev)}
                    className="neu-surface-sm text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1 rounded-full cursor-pointer shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Playback & Interests + desktop rail */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
        <section className="neu-surface rounded-[24px] p-5 space-y-4">
          <h2 className="font-display font-bold text-base text-slate-950 flex items-center gap-2">
            <Tv className="w-4 h-4 text-[#1D6BFF]" />
            Stream Preferences
          </h2>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Default Video Quality
            </p>
            <div className="neu-inset rounded-2xl p-1.5 grid grid-cols-3 gap-1.5">
              {(['Auto', '4K', 'HD'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setDefaultQuality(q)}
                  className={`py-2 rounded-xl text-xs font-display font-bold cursor-pointer transition-all ${
                    defaultQuality === q
                      ? 'neu-surface-sm text-[#1D6BFF]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <p className="text-xs font-display font-bold text-slate-900">
                Goal &amp; Kickoff Alerts
              </p>
              <p className="text-[11px] text-slate-500">
                Instant score updates for saved matches
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPushGoals((p) => !p)}
              aria-pressed={pushGoals}
              className={`w-13 h-7 rounded-full transition-colors p-1 cursor-pointer ${
                pushGoals ? 'bg-[#1D6BFF]' : 'neu-inset-sm'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  pushGoals ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Followed Sports
            </p>
            <div className="flex flex-wrap gap-2">
              {['Football', 'Basketball', 'Tennis', 'Boxing', 'Formula 1'].map(
                (sport) => {
                  const active = favoriteSports.includes(sport);
                  return (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => toggleSport(sport)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition-all ${
                        active
                          ? 'neu-inset-sm text-[#1D6BFF]'
                          : 'neu-surface-sm text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      {sport}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </section>

        {/* Side-rail unit: signed-in viewers only, never on the auth screens */}
        {user && <AdSlot placement="profile-rail" ads={ads} />}
        </div>
      </div>
    </div>
  );
};
