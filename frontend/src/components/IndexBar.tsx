// Index ticker strip — Nifty 50 / Bank Nifty / Sensex with live deltas.
import { useLive } from '../store/live';
import { formatNum, formatPct } from '../lib/format';
import type { IndexPulse } from '../types';

function Cell({ label, value, prev }: { label: string; value: number; prev: number }) {
  const chg = prev > 0 ? ((value - prev) / prev) * 100 : 0;
  const up = chg >= 0;
  return (
    <div className="flex items-baseline gap-2 whitespace-nowrap px-4 py-2.5">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-hud-dim">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${up ? 'bg-hud-bull' : 'bg-hud-bear'}`}
        />
        {label}
      </span>
      <span className="font-num text-sm font-bold text-hud-text">{formatNum(value)}</span>
      <span className={`font-num rounded-full px-1.5 py-0.5 text-[10px] font-bold ${up ? 'bg-hud-bull/10 text-hud-bull' : 'bg-hud-bear/10 text-hud-bear'}`}>
        {prev > 0 ? formatPct(chg) : ''}
      </span>
    </div>
  );
}

export default function IndexBar({ baseline }: { baseline?: IndexPulse | null }) {
  const indices = useLive((s) => s.indices);
  const cur = indices ?? baseline ?? null;
  if (!cur) return null;

  return (
    <div className="panel flex divide-x divide-hud-border overflow-x-auto !rounded-full py-0.5">
      <Cell label="NIFTY 50" value={cur.nifty50} prev={baseline?.nifty50 ?? 0} />
      <Cell label="BANKNIFTY" value={cur.niftyBank} prev={baseline?.niftyBank ?? 0} />
      <Cell label="SENSEX" value={cur.sensex} prev={baseline?.sensex ?? 0} />
      <div className="ml-auto flex items-center gap-1.5 px-4 py-2.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-hud-bull" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-hud-bull">
          streaming
        </span>
      </div>
    </div>
  );
}