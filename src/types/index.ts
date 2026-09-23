// ═══════════════════════════════════════════════════════════════
//  AETHER — Shared TypeScript Types
// ═══════════════════════════════════════════════════════════════

// ─── Users & Tiers ───────────────────────────────────────────
export type SubscriptionTier = 'BASIC' | 'PRO' | 'ELITE';

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  subscription_tier: SubscriptionTier;
  trial_start_date: string | null;
  is_trial_active: boolean;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  tier: SubscriptionTier;
}

export const TIER_RANK: Record<SubscriptionTier, number> = {
  BASIC: 0,
  PRO: 1,
  ELITE: 2,
};

// ─── Market Data ─────────────────────────────────────────────
export type MarketRegime =
  | 'TRENDING_UP'
  | 'TRENDING_DOWN'
  | 'RANGING'
  | 'VOLATILE'
  | 'BREAKOUT';

export interface LiveQuote {
  ticker: string;
  ltp: number;
  change: number;
  change_pct: number;
  volume: number;
  bid: number;
  ask: number;
  open: number;
  high: number;
  low: number;
  prev_close: number;
  timestamp: number;
}

export interface OHLCBar {
  ticker?: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  interval?: string;
}

export interface StockFundamentals {
  ticker: string;
  company_name: string;
  live_price: number;
  pe_ratio: number;
  pb_ratio: number;
  div_yield: number;
  eps_ttm: number;
  book_value: number;
  market_cap: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  market_regime: MarketRegime;
  whale_activity_score: number;
  momentum_score: number;
  updated_at: string;
}

export interface IndexPulse {
  nifty50: number;
  sensex: number;
  niftyBank: number;
}

// ─── Oracle AI Signals ───────────────────────────────────────
export type SignalType = 'BUY' | 'SELL' | 'WATCH' | 'AVOID';
export type TimeHorizon = 'INTRADAY' | 'SWING_3_5D' | 'POSITIONAL_2_4W';

export interface OracleSignal {
  id: string;
  ticker: string;
  signal_type: SignalType;
  confidence: number;
  entry_zone_low: number;
  entry_zone_high: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  target_3: number;
  rationale: string;
  risk_reward_ratio: number;
  generated_at: string;
  expiry: string;
  key_risks?: string[];
  time_horizon?: TimeHorizon;
  catalyst?: string;
}

export interface VectorSearchResult {
  ticker: string;
  similarity: number;
  context: string;
}

// ─── News / Chronos ──────────────────────────────────────────
export type NewsCategory =
  | 'EARNINGS'
  | 'MACRO'
  | 'RBI_POLICY'
  | 'SEBI_REGULATION'
  | 'FII_DII'
  | 'SECTOR_NEWS'
  | 'GLOBAL_CUES'
  | 'CORPORATE_ACTION';

export type ImpactDuration = 'INTRADAY' | 'SHORT_TERM_1W' | 'MEDIUM_TERM_1M';

export interface NewsImpact {
  id: string;
  headline: string;
  source: string;
  url: string;
  sentiment_score: number;
  predicted_move: number;
  confidence_score: number;
  impact_weight: number;
  affected_tickers: string[];
  sector: string;
  category: NewsCategory;
  created_at: string;
  impact_duration?: ImpactDuration;
  summary?: string;
  contrarian_view?: string;
  key_levels_to_watch?: string;
}

// ─── Portfolio ───────────────────────────────────────────────
export interface PortfolioHolding {
  id: string;
  user_id: string;
  ticker: string;
  quantity: number;
  avg_buy_price: number;
  notes?: string | null;
  added_at: string;
  updated_at: string;
}

export interface HoldingWithPnL extends PortfolioHolding {
  current_price: number;
  invested: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
}

// ─── Pulse Studio / Broadcast ────────────────────────────────
export type SocialPlatform = 'INSTAGRAM' | 'YOUTUBE';
export type PostStatus = 'SUCCESS' | 'FAILED';

export interface BroadcastPayload {
  ticker: string;
  signal_type: SignalType;
  confidence: number;
  target: number;
  stop_loss: number;
  pe: number;
  pb: number;
  rationale: string;
}

export interface SocialPostResult {
  platform: SocialPlatform;
  post_id: string;
  url: string;
  status: PostStatus;
  posted_at: string;
}

// ─── WebSocket Protocol ──────────────────────────────────────
export type WsChannel = 'oracle' | 'news' | 'whale_alerts' | `quote:${string}`;

export type WsMessageType =
  | 'QUOTE_UPDATE'
  | 'FUNDAMENTALS_UPDATE'
  | 'ORACLE_SIGNAL'
  | 'NEWS_IMPACT'
  | 'WHALE_ALERT'
  | 'SUBSCRIBED'
  | 'ERROR'
  | 'PONG';

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload: T;
  timestamp: number;
  version: string;
}

export interface WhaleAlert {
  type: string;
  headline?: string;
  ticker?: string;
  predicted_move?: number;
  affected_tickers?: string[];
  impact_weight?: number;
}

// ─── Generic API envelope ────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}
