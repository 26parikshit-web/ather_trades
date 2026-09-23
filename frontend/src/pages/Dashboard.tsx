// Dashboard — Neo layout: hero index card + watchlist + movers + signals + news.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import IndexBar from '../components/IndexBar';
import SignalCard from '../components/SignalCard';
import NewsItem from '../components/NewsItem';
import TickerIcon from '../components/TickerIcon';
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

  const movers = useMemo(
    () =>
      [...rows]
        .sort((a, b) => Math.abs(b.q!.change_pct) - Math.abs(a.q!.change_pct))
        .slice(0, 4),
    [rows]
  );

  const generateSignal = async (ticker: string) => {
    try {
      const sig: OracleSignal = await getSignal(ticker);
      useLive.setState({ signals: [sig, ...useLive.getState().signals].slice(0, 25) });
      pushToast({
        kind: 'signal',
        title: `ORACLE — ${sig.signal_type} ${sig.ticker}`,
        body: `Conf ${(sig.confidence * 100).toFixed(0)}% · SL ${sig.stop_loss}`,
      });
    } catch (e) {
      pushToast({ kind: 'error', title: 'ORACLE ERROR', body: (e as Error).message });
    }
  };

  const liveNifty = useLive((s) => s.indices?.nifty50);
  const curNifty = liveNifty ?? baseline?.nifty50 ?? 0;
  const niftyChg =
    baseline && baseline.nifty50 > 0
      ? ((curNifty - baseline.nifty50) / baseline.nifty50) * 100
      : 0;

  return (
    <div className="space-y-4">
      <IndexBar baseline={baseline} />

      {/* ── Hero row: index spotlight + movers ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="hero-card relative overflow-hidden lg:col-span-2">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-hud-cyan/20 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                NIFTY 50 · Today
              </div>
              <div className="font-num mt-1.5 text-4xl font-extrabold tracking-tight">
                {formatNum(curNifty || baseline?.nifty50)}
              </div>
              <div
                className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                  niftyChg >= 0
                    ? 'bg-[#00E676]/15 text-[#00E676]'
                    : 'bg-hud-bear/20 text-hud-bear'
                }`}
              >
                {niftyChg >= 0 ? '▲' : '▼'} {formatPct(niftyChg)}
                <span className="text-white/50">today</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Link to="/oracle" className="btn btn-primary !rounded-full">
                ⚡ Oracle Signals
              </Link>
              <Link
                to="/portfolio"
                className="btn !rounded-full !border-white/20 !bg-white/10 !text-white hover:!text-white"
              >
                ◔ My Portfolio
              </Link>
            </div>
          </div>
          <p className="relative mt-4 text-[11px] text-white/50">
            Live NSE feed · signals, news impact and whale alerts stream in real time.
          </p>
        </section>

        {/* Top movers */}
        <section className="panel">
          <div className="panel-head">
            <span>Top Movers</span>
            <span className="text-hud-faint">by %</span>
          </div>
          <div className="divide-y divide-hud-border">
            {movers.map(({ ticker, q }) => (
              <Link
                key={ticker}
                to={`/stock/${encodeURIComponent(ticker)}`}
                className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-hud-bg"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <TickerIcon ticker={ticker} size="sm" />
                  <span className="truncate text-[13px] font-bold">{ticker}</span>
                </div>
                <div className="text-right">
                  <div className="font-num text-[13px] font-bold">{formatNum(q!.ltp)}</div>
                  <div className={`font-num text-[11px] font-semibold ${deltaClass(q!.change_pct)}`}>
                    {formatPct(q!.change_pct)}
                  </div>
                </div>
              </Link>
            ))}
            {movers.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-hud-faint">
                {qLoading ? 'Loading feed…' : 'No live quotes'}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Watchlist ── */}
        <section className="panel lg:col-span-2">
          <div className="panel-head">
            <span>Watchlist · Live</span>
            <span className="text-hud-faint">{rows.length} tickers</span>
          </div>

          <div className="max-h-[440px] overflow-y-auto">
            {qLoading && rows.length === 0 && (
              <div className="p-6 text-center text-xs text-hud-faint">Loading feed…</div>
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
                className="flex items-center justify-between border-b border-hud-border px-4 py-3 transition-colors last:border-0 hover:bg-hud-bg"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <TickerIcon ticker={ticker} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold tracking-tight">{ticker}</div>
                    <div className="truncate text-[10px] text-hud-faint">
                      vol {formatNum(q!.volume)} · H {formatNum(q!.high)} · L {formatNum(q!.low)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-num text-sm font-bold">{formatNum(q!.ltp)}</div>
                  <div className={`font-num text-[11px] font-semibold ${deltaClass(q!.change_pct)}`}>
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
            <span>Oracle Tape</span>
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
                    <button
                      key={t}
                      className="btn !rounded-full !px-3 !py-1"
                      onClick={() => generateSignal(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {signals.slice(0, 2).map((s) => (
              <SignalCard key={s.id} sig={s} />
            ))}
          </div>
        </section>
      </div>

      {/* ── News lightning ── */}
      <section className="panel">
        <div className="panel-head">
          <span>News Lightning</span>
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
