// App shell — tactical sidebar + topbar + toast stack.
import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../store/auth';
import { useLive } from '../store/live';
import { me } from '../lib/api';

const NAV = [
  { to: '/', label: 'HUD', icon: '◈', end: true },
  { to: '/oracle', label: 'Oracle', icon: '⚡' },
  { to: '/news', label: 'News', icon: '📰' },
  { to: '/portfolio', label: 'Portfolio', icon: '📊' },
  { to: '/studio', label: 'Pulse Studio', icon: '📣', tier: 'ELITE' as const },
];

function StatusDot() {
  const status = useLive((s) => s.wsStatus);
  const cls =
    status === 'connected'
      ? 'bg-hud-bull shadow-bull'
      : status === 'connecting'
        ? 'bg-hud-warn animate-pulse'
        : 'bg-hud-bear';
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-hud-dim">
      <span className={`h-2 w-2 rounded-full ${cls}`} />
      {status === 'connected' ? 'LIVE' : status === 'connecting' ? 'LINK…' : 'OFFLINE'}
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
          className={`animate-slide-in pointer-events-auto rounded-md border px-3 py-2 text-left backdrop-blur ${
            t.kind === 'signal'
              ? 'border-hud-cyan/50 bg-hud-cyan/10'
              : t.kind === 'whale'
                ? 'border-hud-warn/50 bg-hud-warn/10'
                : 'border-hud-bull/40 bg-hud-bull/10'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider">{t.title}</div>
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

  return (
    <div className="flex min-h-full">
      {/* ── Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-14 flex-col items-center border-r border-hud-border bg-hud-panel/70 py-3 backdrop-blur md:w-52 md:items-stretch md:px-3">
        <div className="mb-4 flex items-center gap-2 px-1 md:px-2">
          <span className="text-lg">⚡</span>
          <span className="hidden text-sm font-black tracking-[0.3em] text-hud-cyan md:block">
            AETHER
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => {
            if (n.tier === 'ELITE' && !isElite) return null;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-2 py-2 text-xs uppercase tracking-widest transition-colors ${
                    isActive
                      ? 'border border-hud-cyan/40 bg-hud-cyan/10 text-hud-cyan'
                      : 'text-hud-dim hover:bg-hud-border/40 hover:text-hud-text'
                  }`
                }
                title={n.label}
              >
                <span className="text-center text-sm">{n.icon}</span>
                <span className="hidden md:block">{n.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 px-1 md:px-2">
          <span
            className={`chip self-start ${
              tier === 'ELITE'
                ? 'border-hud-warn/50 bg-hud-warn/10 text-hud-warn'
                : tier === 'PRO'
                  ? 'border-hud-cyan/50 bg-hud-cyan/10 text-hud-cyan'
                  : 'border-hud-border text-hud-dim'
            }`}
          >
            {tier}
          </span>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex min-h-screen flex-1 flex-col md:pl-52 pl-14">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-hud-border bg-hud-bg/85 px-3 backdrop-blur md:px-5">
          <StatusDot />
          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] text-hud-dim sm:block">
              {user?.email ?? '—'}
            </span>
            <button
              className="btn !py-1.5"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 p-3 md:p-5">{children}</main>

        <footer className="border-t border-hud-border px-4 py-2 text-center text-[10px] uppercase tracking-widest text-hud-faint">
          AETHER · Not financial advice · Data delayed for free tier
        </footer>
      </div>

      <ToastStack />
    </div>
  );
}
