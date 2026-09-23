// Display helpers — Indian market formatting (NSE/BSE).

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function formatINR(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return inr.format(v);
}

export function formatNum(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return num.format(v);
}

export function formatPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

export function formatCompact(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

export function pnlClass(v: number | null | undefined): string {
  if (v == null || v === 0) return 'text-hud-dim';
  return v > 0 ? 'text-hud-bull' : 'text-hud-bear';
}

export function deltaClass(v: number | null | undefined): string {
  if (v == null || v === 0) return 'text-hud-dim';
  return v > 0 ? 'text-hud-bull' : 'text-hud-bear';
}

export function timeAgo(iso: string | number | Date): string {
  const t = typeof iso === 'number' ? iso : new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function timeOfDay(iso: string | number | Date): string {
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function sentimentBadge(score: number): {
  label: string;
  cls: string;
} {
  if (score > 0.15)
    return { label: 'BULLISH', cls: 'border-hud-bull/40 text-hud-bull bg-hud-bull/10' };
  if (score < -0.15)
    return { label: 'BEARISH', cls: 'border-hud-bear/40 text-hud-bear bg-hud-bear/10' };
  return { label: 'NEUTRAL', cls: 'border-hud-warn/40 text-hud-warn bg-hud-warn/10' };
}
