// ═══════════════════════════════════════════════════════════════
//  AETHER ROUTE — Auth (Supabase Auth + app JWT)
// ═══════════════════════════════════════════════════════════════
import { Router, Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { signToken, requireAuth } from '../middleware/auth';
import { log } from '../lib/logger';

const router = Router();

// POST /api/auth/signup — create account, return app JWT
router.post('/signup', async (req: Request, res: Response) => {
  const { email, password, name } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password required' });
    return;
  }
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name || '' } },
    });
    if (error || !data.user) {
      res.status(400).json({ success: false, error: error?.message || 'Signup failed' });
      return;
    }
    // Ensure profile exists (trigger handles it, but upsert as safety net)
    await supabaseAdmin.from('profiles').upsert(
      { id: data.user.id, email, name: name || null },
      { onConflict: 'id' }
    );

    // Auto-confirm the email so users can log in immediately.
    // (Supabase requires email confirmation by default — for this
    //  free/dev setup we confirm via the admin API instead of SMTP.)
    if (!data.user.email_confirmed_at) {
      await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        email_confirm: true,
      });
    }

    const token = signToken({ id: data.user.id, email, name, tier: 'BASIC' });
    res.json({ success: true, data: { user_id: data.user.id, token } });
  } catch (err) {
    log.error('Signup failed', { err });
    res.status(500).json({ success: false, error: 'Signup failed' });
  }
});

// POST /api/auth/login — email/password, return app JWT + tier
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password required' });
    return;
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      res.status(401).json({ success: false, error: error?.message || 'Login failed' });
      return;
    }
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, name')
      .eq('id', data.user.id)
      .single();
    const tier = (profile?.subscription_tier as 'BASIC' | 'PRO' | 'ELITE') || 'BASIC';
    const token = signToken({ id: data.user.id, email, name: profile?.name, tier });
    res.json({ success: true, data: { user_id: data.user.id, tier, token } });
  } catch (err) {
    log.error('Login failed', { err });
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// GET /api/auth/me — current profile (auth required)
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user!.id)
      .single();
    res.json({ success: true, data: profile });
  } catch (err) {
    log.error('Me lookup failed', { err });
    res.status(500).json({ success: false, error: 'Lookup failed' });
  }
});

export default router;
