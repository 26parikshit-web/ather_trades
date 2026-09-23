// ═══════════════════════════════════════════════════════════════
//  AETHER ROUTE — Pulse Studio broadcast (FREE mode)
//  Captions + signal cards are generated; social auto-posting
//  is DISABLED (paid APIs removed). All routes ELITE-gated.
// ═══════════════════════════════════════════════════════════════
import { Router, Request, Response } from 'express';
import { requireAuth, requireTier } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { autoBroadcastAlpha, broadcastDailyRecap } from '../engines/pulse-studio';
import { log } from '../lib/logger';

const router = Router();

// POST /api/broadcast/signal — generate signal card + caption (ELITE)
router.post('/signal', requireAuth, requireTier('ELITE'), async (req: Request, res: Response) => {
  const { ticker, signal_type, confidence, target, stop_loss, pe, pb, rationale } = req.body || {};
  if (!ticker || !signal_type) {
    res.status(400).json({ success: false, error: 'ticker and signal_type required' });
    return;
  }
  try {
    const results = await autoBroadcastAlpha({
      ticker: String(ticker).toUpperCase(),
      signal_type,
      confidence: Number(confidence) || 0,
      target: Number(target) || 0,
      stop_loss: Number(stop_loss) || 0,
      pe: Number(pe) || 0,
      pb: Number(pb) || 0,
      rationale: rationale || '',
    });
    res.json({
      success: true,
      data: { results, note: 'Free mode: caption + signal card logged. Social auto-posting disabled.' },
    });
  } catch (err) {
    log.error('Broadcast failed', { err });
    res.status(500).json({ success: false, error: 'Broadcast failed' });
  }
});

// POST /api/broadcast/daily-recap — trigger daily recap now (ELITE)
router.post('/daily-recap', requireAuth, requireTier('ELITE'), async (_req: Request, res: Response) => {
  await broadcastDailyRecap();
  res.json({ success: true, data: { triggered: true } });
});

// GET /api/broadcast/logs?limit=20 — broadcast history (ELITE)
router.get('/logs', requireAuth, requireTier('ELITE'), async (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const { data, error } = await supabaseAdmin
    .from('broadcast_logs')
    .select('*')
    .order('broadcasted_at', { ascending: false })
    .limit(limit);
  if (error) {
    res.status(500).json({ success: false, error: 'Log fetch failed' });
    return;
  }
  res.json({ success: true, data });
});

export default router;
