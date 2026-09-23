// Stock detail — live intraday chart, fundamentals, Oracle. Neo styling.
import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createChart, type IChartApi, type ISeriesApi, type LineData } from 'lightweight-charts';
import SignalCard from '../components/SignalCard';
import TickerIcon from '../components/TickerIcon';
import { getFundamentals, getSignal } from '../lib/api';
import { useLive } from '../store/live';
import { socket } from '../lib/ws';
import { formatCompact, formatINR, formatNum, formatPct } from '../lib/format';
import type { LiveQuote, OracleSignal, StockFundamentals } from '../types';

export default function StockDetail() {
  const { ticker = '' } = useParams();
  const chartEl = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const pointsRef = useRef<LineData[]>([]);

  const { upsertQuote, pushToast } = useLive();
  const [fund, setFund] = useState<StockFundamentals | null>(null);
  const [quote, setQuote] = useState<LiveQuote | null>(null);
  const [sig, setSig] = useState<OracleSignal | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // ── load fundamentals
  useEffect(() => {
    let alive = true;
    setFund(null);
    setQuote(null);
    setSig(null);
    setErr('');
    (async () => {
      try {
        const f = await getFundamentals(ticker);
        if (alive) setFund(f);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ticker]);

  // ── chart init (light theme)
  useEffect(() => {
    if (!chartEl.current) return;
    const chart = createChart(chartEl.current, {
      height: 300,
      layout: {
        background: { color: 'transparent' },
        textColor: '#476156',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(220,237,228,0.8)' },
        horzLines: { color: 'rgba(220,237,228,0.8)' },
      },
      timeScale: { borderColor: '#DCEDE4', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#DCEDE4' },
      crosshair: { mode: 0 },
    });
    const series = chart.addAreaSeries({
      lineColor: '#00B865',
      topColor: 'rgba(0,184,101,0.28)',
      bottomColor: 'rgba(0,184,101,0.02)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.05 },
    });
    chartRef.current = chart;
    seriesRef.current = series;
    pointsRef.current = [];

    const onResize = () => {
      if (chartEl.current) chart.applyOptions({ width: chartEl.current.clientWidth });
    };
    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [ticker]);

  // ── live quote subscription → chart append
  useEffect(() => {
    const unsub = socket.subscribe(`quote:${ticker}`, (p) => {
      const q = p as LiveQuote;
      if (!q?.ticker) return;
      setQuote(q);
      upsertQuote(q);
      const t = Math.floor(q.timestamp / 1000) as LineData['time'];
      const pts = pointsRef.current;
      if (pts.length && pts[pts.length - 1].time === t) {
        pts[pts.length - 1] = { time: t, value: q.ltp };
      } else {
        pts.push({ time: t, value: q.ltp });
        if (pts.length > 1500) pts.shift();
      }
      seriesRef.current?.setData(pts);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  const summon = async () => {
    setBusy(true);
    try {
      const s: OracleSignal = await getSignal(ticker);
      setSig(s);
      pushToast({
        kind: 'signal',
        title: `ORACLE — ${s.signal_type} ${s.ticker}`,
        body: `Conf ${(s.confidence * 100).toFixed(0)}% · SL ${s.stop_loss}`,
      });
    } catch (e) {
      pushToast({ kind: 'error', title: 'ORACLE ERROR', body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const chg = quote?.change_pct ?? 0;
  const up = chg >= 0;

  return (
    <div className="space-y-4">
      {/* header */}
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3.5">
          <TickerIcon ticker={ticker} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">{ticker}</h1>
              <span className="chip border-hud-border bg-hud-bg text-hud-dim">
                {fund?.market_regime ?? '—'}
              </span>
            </div>
            <div className="text-[11px] text-hud-faint">{fund?.company_name ?? '—'}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-num text-3xl font-extrabold tracking-tight">
            {formatINR(quote?.ltp ?? fund?.live_price)}
          </div>
          <div
            className={`font-num mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
              up ? 'bg-hud-bull/10 text-hud-bull' : 'bg-hud-bear/10 text-hud-bear'
            }`}
          >
            {up ? '▲' : '▼'} {formatPct(chg)} ({formatNum(quote?.change)})
          </div>
        </div>
      </section>

      {err && (
        <div className="rounded-2xl border border-hud-bear/40 bg-hud-bear/10 px-3.5 py-2.5 text-[11px] font-medium text-hud-bear">
          {err}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* chart */}
        <section className="panel lg:col-span-2">
          <div className="panel-head">
            <span>Intraday · Live Session</span>
            <span className="text-hud-faint">{pointsRef.current.length} ticks</span>
          </div>
          <div ref={chartEl} className="h-[300px] w-full p-2" />
        </section>

        {/* fundamentals */}
        <section className="panel">
          <div className="panel-head">
            <span>Fundamentals</span>
            <span className="chip border-hud-warn/40 bg-hud-warn/10 text-hud-warn">
              {fund?.market_regime ?? '—'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-4 text-[11px]">
            {[
              ['PE', fund ? fund.pe_ratio.toFixed(2) : '—'],
              ['PB', fund ? fund.pb_ratio.toFixed(2) : '—'],
              ['EPS', fund ? fund.eps_ttm.toFixed(2) : '—'],
              ['Div Yld', fund ? `${fund.div_yield.toFixed(2)}%` : '—'],
              ['Mkt Cap', fund ? formatCompact(fund.market_cap) : '—'],
              ['Book Value', fund ? formatNum(fund.book_value) : '—'],
              ['52W High', fund ? formatNum(fund.fifty_two_week_high) : '—'],
              ['52W Low', fund ? formatNum(fund.fifty_two_week_low) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-lg bg-hud-bg px-2 py-1.5">
                <span className="text-hud-faint">{k}</span>
                <span className="font-num font-semibold">{v}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-hud-border p-4">
            <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className="text-hud-faint">Whale score</span>
              <span className="text-hud-cyan">
                {(fund?.whale_activity_score ?? 0).toFixed(1)}/10
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-hud-mint">
              <div
                className="h-full rounded-full bg-hud-cyan"
                style={{ width: `${Math.min(100, (fund?.whale_activity_score ?? 0) * 10)}%` }}
              />
            </div>
            <div className="mb-1 mt-3 flex justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className="text-hud-faint">Momentum</span>
              <span className="text-hud-bull">
                {(fund?.momentum_score ?? 0).toFixed(1)}/10
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-hud-mint">
              <div
                className="h-full rounded-full bg-hud-bull"
                style={{ width: `${Math.min(100, (fund?.momentum_score ?? 0) * 10)}%` }}
              />
            </div>
          </div>
        </section>
      </div>

      {/* oracle */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-tight text-hud-text">
            ⚡ Oracle Signal
          </h2>
          <button className="btn btn-primary" onClick={summon} disabled={busy}>
            {busy ? 'Thinking…' : '⚡ Summon Signal'}
          </button>
        </div>
        {sig && <SignalCard sig={sig} />}
        {!sig && (
          <div className="panel p-6 text-center text-[11px] text-hud-faint">
            No signal generated for {ticker} this session.{' '}
            <Link to="/oracle" className="text-hud-cyan hover:underline">
              Open Oracle →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
