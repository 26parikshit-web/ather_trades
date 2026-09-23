// ═══════════════════════════════════════════════════════════════
//  AETHER — Supabase Clients
//  Public (anon, RLS-enforced) + Admin (service_role, bypasses RLS)
// ═══════════════════════════════════════════════════════════════
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { log } from './logger';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  log.warn('Supabase env vars missing — DB calls will fail until configured');
}

// ─── Admin client (engines, cron jobs, internal writes) ──────
// Uses service_role key: bypasses Row Level Security. NEVER expose to clients.
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_KEY || 'missing-service-key',
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

// ─── Public client factory (per-request, respects RLS) ───────
// Pass the caller's JWT so RLS policies scope rows to that user.
export function supabaseForUser(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL || 'http://localhost:54321', SUPABASE_ANON_KEY || 'missing-anon-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// ─── Default public client (unauthenticated reads) ───────────
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY || 'missing-anon-key',
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);
