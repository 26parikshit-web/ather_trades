// News Lightning page — analyzed feed + manual AI analysis + scanner.
import { useEffect, useState, type FormEvent } from 'react';
import NewsItem from '../components/NewsItem';
import { useLive } from '../store/live';
import { analyzeNews, getNews, scanNews } from '../lib/api';

export default function News() {
  const { news, pushToast } = useLive();
  const [minImpact, setMinImpact] = useState(0);
  const [headline, setHeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const list = await getNews(40, minImpact);
        if (alive) useLive.setState({ news: list });
      } catch (e) {
        if (alive)
          pushToast({ kind: 'error', title: 'NEWS ERROR', body: (e as Error).message });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minImpact]);

  const runAnalysis = async (e: FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) return;
    setBusy(true);
    try {
      const n = await analyzeNews(headline.trim());
      useLive.setState({ news: [n, ...useLive.getState().news] });
      setHeadline('');
      pushToast({
        kind: 'news',
        title: '🧠 ANALYZED',
        body: `${n.headline.slice(0, 70)}…`,
      });
    } catch (err) {
      pushToast({ kind: 'error', title: 'ANALYSIS FAILED', body: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const runScan = async () => {
    setBusy(true);
    try {
      const { processed } = await scanNews();
      pushToast({
        kind: 'news',
        title: '📡 SCAN COMPLETE',
        body: `${processed} headlines processed`,
      });
      const list = await getNews(40, minImpact);
      useLive.setState({ news: list });
    } catch (e) {
      pushToast({ kind: 'error', title: 'SCAN FAILED', body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold uppercase tracking-[0.25em] text-hud-cyan">
          📰 News Lightning
        </h1>
        <div className="flex items-center gap-3">
          <label className="text-[10px] uppercase tracking-widest text-hud-faint">
            min impact
          </label>
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.1}
            value={minImpact}
            onChange={(e) => setMinImpact(Number(e.target.value))}
            className="w-24 accent-hud-cyan"
          />
          <span className="font-num text-[11px] text-hud-cyan">
            {(minImpact * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* tools */}
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <form onSubmit={runAnalysis} className="flex min-w-[260px] flex-1 gap-2">
          <input
            className="input"
            placeholder="Paste any headline for instant AI impact analysis…"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
          <button className="btn btn-primary" disabled={busy || !headline.trim()}>
            🧠 ANALYZE
          </button>
        </form>
        <button className="btn" onClick={runScan} disabled={busy}>
          📡 SCAN FEEDS
        </button>
      </div>

      {/* feed */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {news.map((n) => (
          <NewsItem key={n.id} n={n} />
        ))}
        {loading && news.length === 0 && (
          <div className="panel col-span-full p-8 text-center text-xs text-hud-faint">
            ⌁ loading analyzed headlines…
          </div>
        )}
        {!loading && news.length === 0 && (
          <div className="panel col-span-full p-8 text-center text-xs text-hud-faint">
            No headlines match this impact filter — lower it or run a scan.
          </div>
        )}
      </div>
    </div>
  );
}
