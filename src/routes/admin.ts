// ═══════════════════════════════════════════════════════════════
//  AETHER ROUTE — Admin / system management (ELITE only)
// ═══════════════════════════════════════════════════════════════
import { Router, Request, Response } from 'express';
import { requireAuth, requireTier } from '../middleware/auth';
import { cache } from '../lib/cache';
import { wsServer } from '../lib/websocket';
import { runSignalScan } from '../engines/oracle-brain';
import { runNewsScan } from '../engines/chronos-news';
import { broadcastDailyRecap } from '../engines/pulse-studio';
import { log } from '../lib/logger';

const router = Router();
router.use(requireAuth, requireTier('ELITE'));

// GET /api/admin/stats — system overview
router.get('/stats', (_req: Request, res: Response) => {
  const ws = wsServer.getStats();
  res.json({
    success: true,
    data: {
      ws_connected_clients: ws.connected_clients,
      ws_subscriptions: ws.channels,
      uptime_seconds: Math.round(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      free_mode: true,
      ai_provider: 'gemini-1.5-flash',
      embeddings_provider: 'huggingface',
      social_posting: 'disabled',
    },
  });
});

// POST /api/admin/scan/signals — body { tickers: [] }
router.post('/scan/signals', async (req: Request, res: Response) => {
  const { tickers } = req.body || {};
  if (!Array.isArray(tickers) || tickers.length === 0 || tickers.length > 20) {
    res.status(400).json({ success: false, error: 'Provide 1-20 tickers (Gemini free-tier friendly)' });
    return;
  }
  const signals = await runSignalScan(tickers.map((t: string) => String(t).toUpperCase()));
  res.json({ success: true, data: signals });
});

// POST /api/admin/scan/news — manual news scan
router.post('/scan/news', async (_req: Request, res: Response) => {
  const count = await runNewsScan();
  res.json({ success: true, data: { processed: count } });
});

// POST /api/admin/broadcast/recap — trigger daily recap
router.post('/broadcast/recap', async (_req: Request, res: Response) => {
  await broadcastDailyRecap();
  res.json({ success: true, data: { triggered: true } });
});

// POST /api/admin/cache/flush — body { pattern }
router.post('/cache/flush', async (req: Request, res: Response) => {
  const { pattern } = req.body || {};
  if (!pattern || typeof pattern !== 'string') {
    res.status(400).json({ success: false, error: 'pattern required (e.g. quote:*)' });
    return;
  }
  await cache.flushPattern(pattern);
  log.info(`Admin flushed cache pattern: ${pattern}`);
  res.json({ success: true, data: { flushed: pattern } });
});

export default router;
