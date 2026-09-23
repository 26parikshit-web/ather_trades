// Dashboard (HUD) — index bar + live watchlist + oracle tape + news lightning.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import IndexBar from '../components/IndexBar';
import SignalCard from '../components/SignalCard';
import NewsItem from '../components/NewsItem';
import { useLive } from '../store/live';
import { getBulkQuotes, getIndexPulse, getNews, getSignal } from '../lib/api';
import { deltaClass, formatNum, formatPct } from '../lib/format';
import type { IndexPulse, LiveQuote, OracleSignal } from '../types';
import { socket } from '../lib/ws';

export default function Dashboard() {
  const { quotes, upsertQuote, watchlist, signals, news, pushToast } = useLive();
  const [baseline, setBaseline] = useState<IndexPulse | null>(null);
  const [qLoading, setQLoading] = useState(true);

  // 1) REST bootstrap: indices + watchlist + initial news
  useEffect(() => {
    let alive = true;
    (async () => {
      setQLoading(true);
      try {
        const idx = await getIndexPulse();
        if (alive) setBaseline(idx);
      } catch {
        /* backend down */
      }
      try {
        const list = await getBulkQuotes(watchlist);
        if (alive) list.forEach(upsertQuote);
      } catch {
        /* ignore */
      } finally {
        if (alive) setQLoading(false);
      }
      try {
        const latest = await getNews(10, 0.3);
        if (alive)
          useLive.setState({ news: [...latest, ...useLive.getState().news] });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Subscribe each watchlist ticker to the WS quote channel
  useEffect(() => {
    const unsubs = watchlist.map((t) =>
      socket.subscribe(`quote:${t}`, (p) => {
        const q = p as LiveQuote;
        if (q?.ticker) upsertQuote(q);
      })
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist.join(',')]);

  const rows = useMemo(
    () =>
      watchlist.map((t) => ({ ticker: t, q: quotes[t] })).filter((r) => r.q !== undefined),
    [watchlist, quotes]
  );

  const generateSignal = async (ticker: string) => {
    try {
      const sig: OracleSignal = await getSignal(ticker);
      useLive.setState({ signals: [sig, ...useLive.getState().signals].slice(0, 25) });
      pushToast({
        kind: 'signal',
        title: `⚡ ORACLE — ${sig.signal_type} ${sig.ticker}`,
        body: `Conf ${(sig.confidence * 100).toFixed(0)}% · SL ${sig.stop_loss}`,
      });
    } catch (e) {
      pushToast({ kind: 'error', title: 'ORACLE ERROR', body: (e as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <IndexBar baseline={baseline} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Watchlist ── */}
        <section className="panel lg:col-span-2">
          <div className="panel-head">
            <span>◈ Watchlist · Live</span>
            <span className="text-hud-faint">{rows.length} tickers</span>
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {qLoading && rows.length === 0 && (
              <div className="p-6 text-center text-xs text-hud-faint">
                ⌁ loading feed…
              </div>
            )}
            {!qLoading && rows.length === 0 && (
              <div className="p-6 text-center text-xs text-hud-faint">
                No live quotes — backend may be offline
              </div>
            )}
            {rows.map(({ ticker, q }) => (
              <Link
                key={ticker}
                to={`/stock/${encodeURIComponent(ticker)}`}
                className="flex items-center justify-between border-b border-hud-border/60 px-4 py-2.5 transition-colors last:border-0 hover:bg-hud-cyan/5"
              >
                <div>
                  <div className="text-[13px] font-bold tracking-wide">{ticker}</div>
                  <div className="text-[10px] text-hud-faint">
                    vol {formatNum(q!.volume)} · H {formatNum(q!.high)} · L{' '}
                    {formatNum(q!.low)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-num text-sm font-bold">{formatNum(q!.ltp)}</div>
                  <div className={`font-num text-[11px] ${deltaClass(q!.change_pct)}`}>
                    {formatPct(q!.change_pct)} ({formatNum(q!.change)})
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Oracle tape ── */}
        <section className="panel">
          <div className="panel-head">
            <span>⚡ Oracle Tape</span>
            <Link to="/oracle" className="text-hud-cyan hover:underline">
              all →
            </Link>
          </div>
          <div className="space-y-3 p-3">
            {signals.length === 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-hud-faint">
                  No live signals yet — generate one now:
                </p>
                <div className="flex flex-wrap gap-2">
                  {['RELIANCE', 'TCS', 'INFY'].map((t) => (
                    <button key={t} className="btn !py-1" onClick={() => generateSignal(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {signals.slice(0, 3).map((s) => (
              <SignalCard key={s.id} sig={s} />
            ))}
          </div>
        </section>
      </div>

      {/* ── News lightning ── */}
      <section className="panel">
        <div className="panel-head">
          <span>📰 News Lightning</span>
          <Link to="/news" className="text-hud-cyan hover:underline">
            all →
          </Link>
        </div>
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {news.slice(0, 6).map((n) => (
            <NewsItem key={n.id} n={n} />
          ))}
          {news.length === 0 && (
            <div className="col-span-full p-4 text-center text-xs text-hud-faint">
              No analyzed headlines yet — visit the News page to scan.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
