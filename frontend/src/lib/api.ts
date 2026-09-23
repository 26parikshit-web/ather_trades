// ═══════════════════════════════════════════════════════════════
//  AETHER Frontend — API client
//  Dev: Vite proxies /api → localhost:3000
//  Prod: set VITE_API_URL to your deployed backend
// ═══════════════════════════════════════════════════════════════
import type {
  IndexPulse,
  LiveQuote,
  NewsImpact,
  OracleSignal,
  PortfolioSummary,
  Profile,
  StockFundamentals,
  HoldingWithPnL,
  SubscriptionTier,
} from '../types';

export const API_BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Token storage ───────────────────────────────────────────
const TOKEN_KEY = 'aether.token';
const USER_KEY = 'aether.user';

export interface SessionUser {
  id: string;
  email: string;
  tier: SubscriptionTier;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: SessionUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ─── Core request helper ─────────────────────────────────────
async function request<T>(
  path: string,
  init: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const text = await res.text();

  let body: Envelope<T> | null = null;
  try {
    body = text ? (JSON.parse(text) as Envelope<T>) : null;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !body?.success) {
    const message = body?.error || `Request failed (${res.status})`;
    if (res.status === 401) clearSession();
    throw new ApiError(message, res.status);
  }

  return body.data as T;
}

// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════
export async function signup(
  email: string,
  password: string,
  name?: string
): Promise<{ user_id: string; token: string }> {
  return request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  }, false);
}

export async function login(
  email: string,
  password: string
): Promise<{ user_id: string; tier: SubscriptionTier; token: string }> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);
}

// ═══════════════════════════════════════════════════════════════
//  NEWS
// ═══════════════════════════════════════════════════════════════
export function getNews(limit = 20, minImpact = 0): Promise<NewsImpact[]> {
  return request<NewsImpact[]>(`/api/news?limit=${limit}&minImpact=${minImpact}`);
}

export function analyzeNews(
  headline: string,
  source = 'Manual'
): Promise<NewsImpact> {
  return request<NewsImpact>('/api/news/analyze', {
    method: 'POST',
    body: JSON.stringify({ headline, source }),
  });
}

export function scanNews(): Promise<{ processed: number }> {
  return request<{ processed: number }>('/api/news/scan', { method: 'POST' });
}

// ═══════════════════════════════════════════════════════════════
//  PORTFOLIO
// ═══════════════════════════════════════════════════════════════
export interface PortfolioResponse {
  holdings: HoldingWithPnL[];
  summary: PortfolioSummary;
}

export function getPortfolio(): Promise<PortfolioResponse> {
  return request<PortfolioResponse>('/api/portfolio');
}

export function addHolding(
  ticker: string,
  quantity: number,
  avg_buy_price: number,
  notes?: string
): Promise<HoldingWithPnL> {
  return request<HoldingWithPnL>('/api/portfolio', {
    method: 'POST',
    body: JSON.stringify({ ticker, quantity, avg_buy_price, notes }),
  });
}

export function removeHolding(ticker: string): Promise<{ removed: string }> {
  return request<{ removed: string }>(
    `/api/portfolio/holding/${encodeURIComponent(ticker)}`,
    { method: 'DELETE' }
  );
}

export function getPortfolioReview(): Promise<{ review: string }> {
  return request<{ review: string }>('/api/portfolio/ai-review');
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN / ELITE
// ═══════════════════════════════════════════════════════════════
export interface AdminStats {
  ws_connected_clients: number;
  ws_subscriptions: number;
  uptime_seconds: number;
  memory_mb: number;
  free_mode: boolean;
  ai_provider: string;
  embeddings_provider: string;
  market_data: string;
  social_posting: string;
}

export function getAdminStats(): Promise<AdminStats> {
  return request<AdminStats>('/api/admin/stats');
}

export function runSignalScan(tickers: string[]): Promise<OracleSignal[]> {
  return request<OracleSignal[]>('/api/admin/scan/signals', {
    method: 'POST',
    body: JSON.stringify({ tickers }),
  });
}

// ═══════════════════════════════════════════════════════════════
//  BROADCAST (Pulse Studio)
// ═══════════════════════════════════════════════════════════════
export interface BroadcastLog {
  id: string;
  ticker: string | null;
  signal_type: string | null;
  caption: string | null;
  instagram_status: string | null;
  youtube_status: string | null;
  broadcasted_at: string;
}

export function getBroadcastLogs(limit = 20): Promise<BroadcastLog[]> {
  return request<BroadcastLog[]>(`/api/broadcast/logs?limit=${limit}`);
}

export interface BroadcastPayload {
  ticker: string;
  signal_type: string;
  confidence: number;
  target: number;
  stop_loss: number;
  pe: number;
  pb: number;
  rationale: string;
}

export function broadcastSignal(
  payload: BroadcastPayload
): Promise<{ results: unknown[]; note: string }> {
  return request('/api/broadcast/signal', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function me(): Promise<Profile> {
  return request<Profile>('/api/auth/me');
}

// ═══════════════════════════════════════════════════════════════
//  MARKET DATA
// ═══════════════════════════════════════════════════════════════
export function getIndexPulse(): Promise<IndexPulse> {
  return request<IndexPulse>('/api/stocks/index');
}

export function getQuote(ticker: string): Promise<LiveQuote> {
  return request<LiveQuote>(`/api/stocks/quote/${encodeURIComponent(ticker)}`);
}

export function getFundamentals(ticker: string): Promise<StockFundamentals> {
  return request<StockFundamentals>(
    `/api/stocks/fundamentals/${encodeURIComponent(ticker)}`
  );
}

export function getBulkQuotes(tickers: string[]): Promise<LiveQuote[]> {
  return request<LiveQuote[]>('/api/stocks/bulk', {
    method: 'POST',
    body: JSON.stringify({ tickers }),
  });
}

export function getSignal(ticker: string): Promise<OracleSignal> {
  return request<OracleSignal>(`/api/stocks/signal/${encodeURIComponent(ticker)}`);
}

export function getHover(
  ticker: string
): Promise<{ ticker: string; insight: string }> {
  return request<{ ticker: string; insight: string }>(
    `/api/stocks/hover/${encodeURIComponent(ticker)}`
  );
}
