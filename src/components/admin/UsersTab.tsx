import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, UserRound, Users } from 'lucide-react';
import { AdminUserRecord, fetchAdminUsers } from '../../lib/api';
import { Spinner } from './ui';

interface UsersTabProps {
  onToast: (msg: string, error?: boolean) => void;
}

/** Registered site viewers (accounts created through the sign-up flow). */
export const UsersTab: React.FC<UsersTabProps> = ({ onToast }) => {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetchAdminUsers();
      setUsers(res.users);
      setTotal(res.total);
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) => u.username.toLowerCase().includes(q) || (u.country ?? '').toLowerCase().includes(q))
    : users;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = users.filter((u) => {
    const t = Date.parse(u.createdAt ?? '');
    return Number.isFinite(t) && t >= weekAgo;
  }).length;

  const fmtDate = (iso?: string) => {
    const t = Date.parse(iso ?? '');
    if (!Number.isFinite(t)) return '—';
    return new Date(t).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const fmtTime = (iso?: string) => {
    const t = Date.parse(iso ?? '');
    return Number.isFinite(t) ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neon-card neon-card-accent p-4 flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1D6BFF] to-[#7C3AED] text-white flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-xl text-slate-950 tabular-nums leading-none">
              {loading ? '—' : total}
            </p>
            <p className="mt-1 text-[10.5px] text-slate-500">Registered users</p>
          </div>
        </div>
        <div className="neon-card p-4 flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-[#EEF4FF] text-[#1D6BFF] flex items-center justify-center shrink-0">
            <UserRound className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-xl text-slate-950 tabular-nums leading-none">
              {loading ? '—' : newThisWeek}
            </p>
            <p className="mt-1 text-[10.5px] text-slate-500">New in the last 7 days</p>
          </div>
        </div>
        <div className="neon-card p-4 flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-[#EEF4FF] text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-xl text-slate-950 tabular-nums leading-none">
              {loading ? '—' : users.length}
            </p>
            <p className="mt-1 text-[10.5px] text-slate-500">Listed (newest first)</p>
          </div>
        </div>
      </section>

      {/* Search + list */}
      <section className="neon-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-display font-extrabold text-sm text-slate-900">
            Registered Users <span className="text-slate-500">({filtered.length})</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search username or country…"
                className="neon-input w-56 py-1.5 pl-8 pr-3 text-[11px]"
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={refreshing}
              className="neon-btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-50"
            >
              {refreshing ? <Spinner /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/70 bg-[#F4F8FF] p-8 text-center text-xs text-slate-500">
            {q ? `No users match “${searchQuery.trim()}”.` : 'No registered users yet — sign-ups from the site appear here.'}
          </div>
        ) : (
          <div className="divide-y divide-white/70">
            {filtered.map((u, i) => (
              <div key={u.id} className="flex items-center gap-3 py-2.5">
                <span className="w-9 h-9 rounded-full neu-inset-sm flex items-center justify-center text-[11px] font-display font-black text-slate-600 shrink-0">
                  {u.username.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-xs text-slate-900 truncate">{u.username}</p>
                  <p className="text-[10px] text-slate-500">
                    {fmtDate(u.createdAt)} {fmtTime(u.createdAt) && `· ${fmtTime(u.createdAt)}`}
                  </p>
                </div>
                {u.country && <span className="neon-badge shrink-0">{u.country}</span>}
                <span className="text-[10px] text-slate-400 tabular-nums shrink-0 hidden sm:inline">#{i + 1}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
