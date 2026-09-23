// Live store — indices, streaming quotes, signals, news, whale alerts.
// Fed by REST on mount + WebSocket stream afterwards.
import { create } from 'zustand';
import type {
  IndexPulse,
  LiveQuote,
  NewsImpact,
  OracleSignal,
  WhaleAlert,
} from '../types';
import { socket, type WsStatus } from '../lib/ws';

export interface Toast {
  id: number;
  kind: 'signal' | 'news' | 'whale' | 'error';
  title: string;
  body: string;
}

interface LiveState {
  wsStatus: WsStatus;
  indices: IndexPulse | null;
  quotes: Record<string, LiveQuote>;
  signals: OracleSignal[];        // newest first
  news: NewsImpact[];             // newest first
  alerts: WhaleAlert[];
  toasts: Toast[];
  watchlist: string[];
  start: () => void;
  upsertQuote: (q: LiveQuote) => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 1;
let started = false;

export const useLive = create<LiveState>((set, get) => ({
  wsStatus: 'disconnected',
  indices: null,
  quotes: {},
  signals: [],
  news: [],
  alerts: [],
  toasts: [],
  watchlist: [
    'RELIANCE',
    'TCS',
    'INFY',
    'HDFCBANK',
    'ICICIBANK',
    'SBIN',
    'TATAMOTORS',
    'ADANIENT',
    'NIFTY 50',
    'BANKNIFTY',
  ],

  upsertQuote: (q) =>
    set((s) => ({ quotes: { ...s.quotes, [q.ticker]: q } })),

  pushToast: (t) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), 6000);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  start: () => {
    if (started) return;
    started = true;

    socket.onStatus((s) => set({ wsStatus: s }));

    // Live index values
    socket.on('QUOTE_UPDATE', (payload) => {
      const q = payload as LiveQuote;
      if (!q?.ticker) return;
      get().upsertQuote(q);
      if (q.ticker === 'NIFTY 50' || q.ticker === 'BANKNIFTY') {
        set((s) => {
          const cur = s.indices ?? { nifty50: 0, sensex: 0, niftyBank: 0 };
          if (q.ticker === 'NIFTY 50') return { indices: { ...cur, nifty50: q.ltp } };
          return { indices: { ...cur, niftyBank: q.ltp } };
        });
      }
    });

    socket.on('ORACLE_SIGNAL', (payload) => {
      const sig = payload as OracleSignal;
      if (!sig?.ticker) return;
      set((s) => ({
        signals: [sig, ...s.signals.filter((x) => x.id !== sig.id)].slice(0, 25),
      }));
      get().pushToast({
        kind: 'signal',
        title: `⚡ ORACLE — ${sig.signal_type} ${sig.ticker}`,
        body: `Conf ${(sig.confidence * 100).toFixed(0)}% · SL ${sig.stop_loss} · T1 ${sig.target_1}`,
      });
    });

    socket.on('NEWS_IMPACT', (payload) => {
      const n = payload as NewsImpact;
      if (!n?.headline) return;
      set((s) => ({
        news: [n, ...s.news.filter((x) => x.id !== n.id)].slice(0, 40),
      }));
      get().pushToast({
        kind: 'news',
        title: '📰 News Lightning',
        body: n.headline.slice(0, 90),
      });
    });

    socket.on('WHALE_ALERT', (payload) => {
      const a = payload as WhaleAlert;
      set((s) => ({ alerts: [a, ...s.alerts].slice(0, 20) }));
      get().pushToast({
        kind: 'whale',
        title: '🐋 WHALE ALERT',
        body: (a.headline ?? a.type ?? '').slice(0, 90),
      });
    });

    socket.connect();
  },
}));
