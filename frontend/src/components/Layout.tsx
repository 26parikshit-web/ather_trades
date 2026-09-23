// App shell — Neo-style sidebar + topbar + mobile bottom-nav + toasts.
import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../store/auth';
import { useLive } from '../store/live';
import { me } from '../lib/api';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▤', end: true },
  { to: '/oracle', label: 'Oracle', icon: '⚡' },
  { to: '/news', label: 'News', icon: '◉' },
  { to: '/portfolio', label: 'Portfolio', icon: '◔' },
  { to: '/studio', label: 'Pulse Studio', icon: '▣', tier: 'ELITE' as const },
  { to: '/admin', label: 'Admin', icon: '◆', tier: 'ELITE' as const },
];

const BOTTOM_NAV = ['/', '/oracle', '/portfolio', '/news'];

function StatusDot() {
  const status = useLive((s) => s.wsStatus);
  const cls =
    status === 'connected'
      ? 'bg-hud-bull'
      : status === 'connecting'
        ? 'bg-hud-warn animate-pulse'
        : 'bg-hud-bear';
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-hud-dim shadow-[0_1px_2px_rgba(12,31,23,0.06)]">
      <span className={`h-2 w-2 rounded-full ${cls}`} />
      {status === 'connected' ? 'Live' : status === 'connecting' ? 'Link…' : 'Offline'}
    </span>
  );
}

function ToastStack() {
  const toasts = useLive((s) => s.toasts);
  const dismiss = useLive((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed right-3 top-16 z-50 flex w-[min(340px,calc(100vw-24px))] flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="animate-slide-in pointer-events-auto rounded-2xl border border-hud-border bg-white px-3.5 py-2.5 text-left shadow-card"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-hud-text">
            {t.title}
          </div>
          <div className="mt-0.5 text-[11px] text-hud-dim">{t.body}</div>
        </button>
      ))}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const start = useLive((s) => s.start);
  const navigate = useNavigate();
  const [tier, setTier] = useState(user?.tier ?? 'BASIC');

  useEffect(() => {
    start();
    me()
      .then((p) => setTier(p.subscription_tier))
      .catch(() => undefined);
  }, [start]);

  const isElite = tier === 'ELITE';
  const visibleNav = NAV.filter((n) => n.tier !== 'ELITE' || isElite);

  return (
    <div className="flex min-h-full">
      {/* ── Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center border-r border-hud-border bg-white/90 py-4 backdrop-blur md:flex md:w-56 md:items-stretch md:px-3">
        <div className="mb-6 flex items-center gap-2.5 px-1 md:px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-hud-ink text-base text-[#00E676] shadow-card">
            ⚡
          </span>
          <span className="hidden text-[15px] font-extrabold tracking-[0.2em] text-hud-text md:block">
            AETHER
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5">
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-full px-3 py-2.5 text-[13px] font-semibold transition-all ${
                  isActive
                    ? 'bg-hud-ink text-white shadow-card'
                    : 'text-hud-dim hover:bg-hud-mint hover:text-hud-text'
                }`
              }
              title={n.label}
            >
              <span className="text-center text-sm">{n.icon}</span>
              <span className="hidden md:block">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 px-1 md:px-2">
          <span
            className={`chip self-start ${
              tier === 'ELITE'
                ? 'border-hud-warn/50 bg-hud-warn/10 text-hud-warn'
                : tier === 'PRO'
                  ? 'border-hud-cyan/50 bg-hud-cyan/10 text-hud-cyan'
                  : 'border-hud-border bg-hud-bg text-hud-dim'
            }`}
          >
            {tier}
          </span>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex min-h-screen flex-1 flex-col pb-20 md:pb-0 md:pl-56 pl-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-hud-border bg-white/85 px-3 backdrop-blur md:px-6">
          <div className="relative min-w-0 flex-1 max-w-md">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-hud-faint">
              ⌕
            </span>
            <input
              className="input !rounded-full !py-2 pl-9 text-[13px]"
              placeholder="Search markets…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const q = (e.target as HTMLInputElement).value.trim().toUpperCase();
                  if (q) navigate(`/stock/${encodeURIComponent(q)}`);
                }
              }}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <StatusDot />
            <span className="hidden text-[11px] text-hud-dim lg:block">
              {user?.email ?? '—'}
            </span>
            <button
              className="btn !rounded-full !px-3.5 !py-1.5"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Logout
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-3 md:p-6">{children}</main>

        <footer className="px-4 pb-3 text-center text-[10px] uppercase tracking-widest text-hud-faint md:pb-1">
          AETHER · Not financial advice · Data delayed for free tier
        </footer>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around gap-1 border-t border-hud-border bg-white/95 px-2 py-2 backdrop-blur md:hidden">
        {visibleNav.map((n) => (
          <NavLink
            key={`m-${n.to}`}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                BOTTOM_NAV.includes(n.to) || n.to === '/admin'
                  ? isActive
                    ? 'bg-hud-ink text-white'
                    : 'text-hud-dim'
                  : 'hidden'
              }`
            }
          >
            <span className="text-sm leading-none">{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <ToastStack />
    </div>
  );
}
