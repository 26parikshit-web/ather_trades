// News impact row — sentiment badge, predicted move, affected tickers.
import type { NewsImpact } from '../types';
import { formatPct, sentimentBadge, timeAgo } from '../lib/format';

export default function NewsItem({ n }: { n: NewsImpact }) {
  const sent = sentimentBadge(n.sentiment_score);
  const impact = Math.round((n.impact_weight ?? 0) * 100);

  return (
    <a
      href={n.url || '#'}
      target={n.url ? '_blank' : undefined}
      rel="noreferrer"
      className="panel block p-4 transition-shadow hover:shadow-cyan"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className={`chip shrink-0 ${sent.cls}`}>{sent.label}</span>
        <div className="flex items-center gap-2 text-[10px] text-hud-faint">
          {n.source && <span className="font-semibold uppercase tracking-wider">{n.source}</span>}
          <span>·</span>
          <span>{timeAgo(n.created_at)}</span>
        </div>
      </div>

      <h3 className="text-[13px] font-semibold leading-snug text-hud-text">{n.headline}</h3>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            n.predicted_move >= 0 ? 'bg-hud-bull/10 text-hud-bull' : 'bg-hud-bear/10 text-hud-bear'
          }`}
        >
          pred {formatPct(n.predicted_move)}
        </span>
        <span className="text-hud-dim">impact {impact}%</span>
        <span className="text-hud-dim">conf {Math.round((n.confidence_score ?? 0) * 100)}%</span>
        {n.sector && (
          <span className="text-hud-faint uppercase tracking-wider">{n.sector}</span>
        )}
      </div>

      {n.affected_tickers?.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {n.affected_tickers.slice(0, 6).map((t) => (
            <span
              key={t}
              className="rounded-full bg-hud-mint px-2 py-0.5 text-[10px] font-semibold text-hud-dim"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}