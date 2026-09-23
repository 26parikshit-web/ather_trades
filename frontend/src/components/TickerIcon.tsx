// Ticker avatar — circular monogram with deterministic brand-ish color.
const PALETTE = [
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
];

function hash(t: string): number {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return h;
}

export default function TickerIcon({
  ticker,
  size = 'md',
}: {
  ticker: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const clean = (ticker || '?').replace(/[^A-Z0-9]/gi, '');
  const initials = clean.slice(0, 2).toUpperCase() || '?';
  const cls =
    size === 'sm'
      ? 'h-8 w-8 text-[11px]'
      : size === 'lg'
        ? 'h-14 w-14 text-lg'
        : 'h-10 w-10 text-xs';
  const color = PALETTE[hash(ticker) % PALETTE.length];
  return (
    <span
      className={`${cls} ${color} inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm`}
    >
      {initials}
    </span>
  );
}