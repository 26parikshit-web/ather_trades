// ═══════════════════════════════════════════════════════════════
//  AETHER ROUTE — Market data + Oracle signals
// ═══════════════════════════════════════════════════════════════
import { Router, Request, Response } from 'express';
import { requireAuth, requireTier } from '../middleware/auth';
import { fetchLiveQuote, fetchLiveFundamentals, fetchNiftyIndex, fetchBulkQuotes } from '../engines/data-pulse';
import { generateOracleSignal, getHoverIntelligence, findSimilarStocks } from '../engines/oracle-brain';
import { log } from '../lib/logger';

const router = Router();

// GET /api/stocks/quote/:ticker — live quote (all tiers)
router.get('/quote/:ticker', requireAuth, async (req: Request, res: Response) => {
  const quote = await fetchLiveQuote(req.params.ticker.toUpperCase());
  if (!quote) {
    res.status(404).json({ success: false, error: 'Quote unavailable' });
    return;
  }
  res.json({ success: true, data: quote });
});

// GET /api/stocks/fundamentals/:ticker — live fundamentals (all tiers)
router.get('/fundamentals/:ticker', requireAuth, async (req: Request, res: Response) => {
  const funda = await fetchLiveFundamentals(req.params.ticker.toUpperCase());
  if (!funda) {
    res.status(404).json({ success: false, error: 'Fundamentals unavailable' });
    return;
  }
  res.json({ success: true, data: funda });
});

// GET /api/stocks/index — Nifty/Sensex pulse (all tiers)
router.get('/index', requireAuth, async (_req: Request, res: Response) => {
  const index = await fetchNiftyIndex();
  res.json({ success: true, data: index });
});

// POST /api/stocks/bulk — bulk quotes, body { tickers: [] }
router.post('/bulk', requireAuth, async (req: Request, res: Response) => {
  const { tickers } = req.body || {};
  if (!Array.isArray(tickers) || tickers.length === 0 || tickers.length > 50) {
    res.status(400).json({ success: false, error: 'Provide 1-50 tickers' });
    return;
  }
  const quotes = await fetchBulkQuotes(tickers.map((t: string) => String(t).toUpperCase()));
  res.json({ success: true, data: quotes });
});

// GET /api/stocks/signal/:ticker — Oracle AI signal (PRO+)
router.get('/signal/:ticker', requireAuth, requireTier('PRO'), async (req: Request, res: Response) => {
  const signal = await generateOracleSignal(req.params.ticker.toUpperCase());
  if (!signal) {
    res.status(503).json({ success: false, error: 'Signal generation failed — AI unavailable' });
    return;
  }
  res.json({ success: true, data: signal });
});

// GET /api/stocks/hover/:ticker — quick insight (PRO+)
router.get('/hover/:ticker', requireAuth, requireTier('PRO'), async (req: Request, res: Response) => {
  const insight = await getHoverIntelligence(req.params.ticker.toUpperCase());
  res.json({ success: true, data: { ticker: req.params.ticker.toUpperCase(), insight } });
});

// GET /api/stocks/similar/:ticker?context=... — vector search (PRO+)
router.get('/similar/:ticker', requireAuth, requireTier('PRO'), async (req: Request, res: Response) => {
  const context = String(req.query.context || req.params.ticker);
  const results = await findSimilarStocks(req.params.ticker.toUpperCase(), context);
  res.json({ success: true, data: results });
});

export default router;
