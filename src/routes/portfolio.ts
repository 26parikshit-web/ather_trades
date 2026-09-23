// ═══════════════════════════════════════════════════════════════
//  AETHER ROUTE — Portfolio holdings + P&L + AI review
// ═══════════════════════════════════════════════════════════════
import { Router, Request, Response } from 'express';
import { requireAuth, requireTier } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import { fetchLiveQuote } from '../engines/data-pulse';
import { reviewPortfolioWithAI } from '../engines/oracle-brain';
import { log } from '../lib/logger';

const router = Router();

// GET /api/portfolio — all holdings with P&L (PRO+)
router.get('/', requireAuth, requireTier('PRO'), async (req: Request, res: Response) => {
  try {
    const { data: holdings, error } = await supabaseAdmin
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('added_at', { ascending: false });
    if (error) throw error;

    const enriched = await Promise.all(
      (holdings || []).map(async (h) => {
        const quote = await fetchLiveQuote(h.ticker).catch(() => null);
        const currentPrice = quote?.ltp ?? h.avg_buy_price;
        const invested = h.quantity * h.avg_buy_price;
        const currentValue = h.quantity * currentPrice;
        return {
          ...h,
          current_price: currentPrice,
          invested,
          current_value: currentValue,
          pnl: currentValue - invested,
          pnl_pct: invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
        };
      })
    );

    const totalInvested = enriched.reduce((s, h) => s + h.invested, 0);
    const totalValue = enriched.reduce((s, h) => s + h.current_value, 0);
    res.json({
      success: true,
      data: {
        holdings: enriched,
        summary: {
          total_invested: totalInvested,
          total_value: totalValue,
          total_pnl: totalValue - totalInvested,
          total_pnl_pct: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
        },
      },
    });
  } catch (err) {
    log.error('Portfolio fetch failed', { err });
    res.status(500).json({ success: false, error: 'Portfolio fetch failed' });
  }
});

// POST /api/portfolio — add holding (PRO+)
router.post('/', requireAuth, requireTier('PRO'), async (req: Request, res: Response) => {
  const { ticker, quantity, avg_buy_price, notes } = req.body || {};
  if (!ticker || !quantity || !avg_buy_price) {
    res.status(400).json({ success: false, error: 'ticker, quantity, avg_buy_price required' });
    return;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('portfolio_holdings')
      .upsert(
        {
          user_id: req.user!.id,
          ticker: String(ticker).toUpperCase(),
          quantity: Number(quantity),
          avg_buy_price: Number(avg_buy_price),
          notes: notes || null,
        },
        { onConflict: 'user_id,ticker' }
      )
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    log.error('Add holding failed', { err });
    res.status(500).json({ success: false, error: 'Add holding failed' });
  }
});

// DELETE /api/portfolio/holding/:ticker — remove holding (PRO+)
router.delete('/holding/:ticker', requireAuth, requireTier('PRO'), async (req: Request, res: Response) => {
  try {
    const { error } = await supabaseAdmin
      .from('portfolio_holdings')
      .delete()
      .eq('user_id', req.user!.id)
      .eq('ticker', req.params.ticker.toUpperCase());
    if (error) throw error;
    res.json({ success: true, data: { removed: req.params.ticker.toUpperCase() } });
  } catch (err) {
    log.error('Remove holding failed', { err });
    res.status(500).json({ success: false, error: 'Remove holding failed' });
  }
});

// GET /api/portfolio/ai-review — AI portfolio review (ELITE)
router.get('/ai-review', requireAuth, requireTier('ELITE'), async (req: Request, res: Response) => {
  const review = await reviewPortfolioWithAI(req.user!.id);
  res.json({ success: true, data: { review } });
});

export default router;
