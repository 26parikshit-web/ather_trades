// Oracle signal card — entry zone, SL, targets, confidence bar.
import { Link } from 'react-router-dom';
import type { OracleSignal } from '../types';
import { formatINR, timeAgo } from '../lib/format';

const SIGNAL_STYLES: Record<string, string> = {
  BUY: 'border-hud-bull/50 text-hud-bull bg-hud-bull/10',
  SELL: 'border-hud-bear/50 text-hud-bear bg-hud-bear/10',
  WATCH: 'border-hud-warn/50 text-hud-warn bg-hud-warn/10',
  AVOID: 'border-hud-faint text-hud-dim',
};

export default function SignalCard({ sig }: { sig: OracleSignal }) {
  const pct = Math.round(sig.confidence * 100);
  return (
    <div className="panel animate-slide-in p-4 transition-colors hover:border-hud-cyan/40">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <Link
            to={`/stock/${sig.ticker}`}
            className="text-sm font-bold tracking-wider text-hud-text hover:text-hud-cyan"
          >
            {sig.ticker}
          </Link>
          <div className="text-[10px] text-hud-faint">{timeAgo(sig.generated_at)}</div>
        </div>
        <span className={`chip ${SIGNAL_STYLES[sig.signal_type] ?? SIGNAL_STYLES.WATCH}`}>
          {sig.signal_type}
        </span>
      </div>

      {/* confidence */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-hud-faint">
          <span>Confidence</span>
          <span className="font-bold text-hud-text">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-hud-border">
          <div
            className={`h-full ${
              pct >= 75 ? 'bg-hud-bull' : pct >= 50 ? 'bg-hud-cyan' : 'bg-hud-warn'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* levels */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-hud-faint">Entry</span>
          <span className="font-num">
            {formatINR(sig.entry_zone_low)}–{formatINR(sig.entry_zone_high).replace('₹', '')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-hud-faint">Stop</span>
          <span className="font-num text-hud-bear">{formatINR(sig.stop_loss)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-hud-faint">T1</span>
          <span className="font-num text-hud-bull">{formatINR(sig.target_1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-hud-faint">R:R</span>
          <span className="font-num">{sig.risk_reward_ratio?.toFixed?.(2) ?? '—'}</span>
        </div>
      </div>

      {/* rationale */}
      <p className="mt-3 border-t border-hud-border pt-2.5 text-[11px] leading-relaxed text-hud-dim">
        {sig.rationale}
      </p>
    </div>
  );
}
