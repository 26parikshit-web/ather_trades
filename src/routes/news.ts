// ═══════════════════════════════════════════════════════════════
//  AETHER ROUTE — News feed + manual analysis
// ═══════════════════════════════════════════════════════════════
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getLatestNewsFeed, analyzeNewsImpact, runNewsScan } from '../engines/chronos-news';

const router = Router();

// GET /api/news?limit=20&category=&minImpact=0 — latest feed (all tiers)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const category = req.query.category ? String(req.query.category) : undefined;
  const minImpact = parseInt(String(req.query.minImpact || '0'), 10) || 0;
  const feed = await getLatestNewsFeed(limit, category, minImpact);
  res.json({ success: true, data: feed });
});

// POST /api/news/analyze — analyze a headline now, body { headline, source?, url? }
router.post('/analyze', requireAuth, async (req: Request, res: Response) => {
  const { headline, source, url } = req.body || {};
  if (!headline || typeof headline !== 'string') {
    res.status(400).json({ success: false, error: 'headline required' });
    return;
  }
  const result = await analyzeNewsImpact(headline, source || 'Manual', url || '');
  if (!result) {
    res.status(503).json({ success: false, error: 'Analysis failed — AI unavailable' });
    return;
  }
  res.json({ success: true, data: result });
});

// POST /api/news/scan — trigger a manual news scan (all authed users)
router.post('/scan', requireAuth, async (_req: Request, res: Response) => {
  const count = await runNewsScan();
  res.json({ success: true, data: { processed: count } });
});

export default router;
