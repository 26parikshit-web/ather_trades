// ═══════════════════════════════════════════════════════════════
//  AETHER — Auth Middleware
//  JWT verification + subscription tier gates
// ═══════════════════════════════════════════════════════════════
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../lib/supabase';
import { log } from '../lib/logger';
import { TIER_RANK, type AuthUser, type SubscriptionTier } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ─── Express Request augmentation ────────────────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, userId: user.id, email: user.email, tier: user.tier },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      sub?: string;
      userId?: string;
      email?: string;
      tier?: SubscriptionTier;
    };
    const id = decoded.sub || decoded.userId;
    if (!id) return null;
    return { id, email: decoded.email || '', tier: (decoded.tier as SubscriptionTier) || 'BASIC' };
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  if (typeof req.query.token === 'string') return req.query.token;
  return null;
}

// ─── requireAuth: valid JWT mandatory ────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Missing authentication token' });
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  req.user = user;
  req.token = token;
  next();
}

// ─── requireTier: gate by minimum subscription tier ──────────
// Usage: router.get('/signal', requireAuth, requireTier('PRO'), handler)
export function requireTier(minTier: SubscriptionTier) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Refresh tier from DB so upgrades/downgrades take effect without re-login
    refreshTier(req.user)
      .then(() => {
        if (TIER_RANK[req.user!.tier] >= TIER_RANK[minTier]) {
          next();
        } else {
          res.status(403).json({
            success: false,
            error: `This endpoint requires ${minTier} tier or higher`,
            current_tier: req.user!.tier,
          });
        }
      })
      .catch((err) => {
        log.error('Tier check failed', { err: String(err) });
        res.status(500).json({ success: false, error: 'Authorization check failed' });
      });
  };
}

// Re-read the profile's tier so mid-session subscription changes are honored.
async function refreshTier(user: AuthUser): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, is_trial_active, trial_start_date')
      .eq('id', user.id)
      .single();

    if (!data) return;

    let tier = (data.subscription_tier as SubscriptionTier) || 'BASIC';

    // Expired trial downgrades to BASIC
    if (data.is_trial_active && data.trial_start_date) {
      const trialEnd = new Date(data.trial_start_date).getTime() + 14 * 24 * 60 * 60 * 1000;
      if (Date.now() > trialEnd) tier = 'BASIC';
    }

    user.tier = tier;
  } catch {
    // Keep the token's tier if the DB lookup fails
  }
}

export { JWT_SECRET };
