// ═══════════════════════════════════════════════════════════════
//  AETHER ENGINE 1 — DATA PULSE
//  Live NSE/BSE scraper, fundamentals calculator, WebSocket feeder
// ═══════════════════════════════════════════════════════════════
import axios from 'axios';
import * as cheerio from 'cheerio';
import cron from 'node-cron';
import { supabaseAdmin } from '../lib/supabase';
import { cache, TTL } from '../lib/cache';
import { wsServer } from '../lib/websocket';
import { log } from '../lib/logger';
import { LiveQuote, StockFundamentals, MarketRegime, OHLCBar } from '../types';

// ─── NSE Headers (required to avoid bot detection) ──────────
const NSE_HEADERS = {
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.nseindia.com/',
  'X-Requested-With': 'XMLHttpRequest',
};

// ─── Axios instance with session cookie support ──────────────
const nseClient = axios.create({
  baseURL: 'https://www.nseindia.com',
  headers: NSE_HEADERS,
  timeout: 10_000,
  withCredentials: true,
});

// ─── RapidAPI fallback client ────────────────────────────────
const rapidClient = axios.create({
  baseURL: `https://${process.env.NSE_RAPIDAPI_HOST}`,
  headers: {
    'X-RapidAPI-Key': process.env.NSE_RAPIDAPI_KEY!,
    'X-RapidAPI-Host': process.env.NSE_RAPIDAPI_HOST!,
  },
  timeout: 8_000,
});

// ═══════════════════════════════════════════════════════════════
//  LIVE QUOTE FETCHER
// ═══════════════════════════════════════════════════════════════
export async function fetchLiveQuote(ticker: string): Promise<LiveQuote | null> {
  const cacheKey = `quote:${ticker}`;
  const cached = await cache.get<LiveQuote>(cacheKey);
  if (cached) return cached;

  try {
    // Primary: NSE official API
    const response = await nseClient.get(`/api/quote-equity?symbol=${ticker}`);
    const d = response.data;
    const quote: LiveQuote = {
      ticker,
      ltp: d.priceInfo?.lastPrice ?? 0,
      change: d.priceInfo?.change ?? 0,
      change_pct: d.priceInfo?.pChange ?? 0,
      volume: d.tradeInfo?.totalTradedVolume ?? 0,
      bid: d.priceInfo?.intraDayHighLow?.min ?? 0,
      ask: d.priceInfo?.intraDayHighLow?.max ?? 0,
      open: d.priceInfo?.open ?? 0,
      high: d.priceInfo?.intraDayHighLow?.max ?? 0,
      low: d.priceInfo?.intraDayHighLow?.min ?? 0,
      prev_close: d.priceInfo?.previousClose ?? 0,
      timestamp: Date.now(),
    };

    await cache.set(cacheKey, quote, TTL.LIVE_QUOTE);
    return quote;
  } catch (primaryErr) {
    log.warn(`NSE primary failed for ${ticker}, trying RapidAPI fallback`);
  }

  try {
    // Fallback: RapidAPI stock price
    const r = await rapidClient.get('/price', { params: { Indices: ticker } });
    const d = r.data?.[0];
    if (!d) return null;

    const quote: LiveQuote = {
      ticker,
      ltp: parseFloat(d.lastPrice?.replace(',', '') || '0'),
      change: parseFloat(d.change || '0'),
      change_pct: parseFloat(d.pChange || '0'),
      volume: parseInt(d.totalTradedVolume?.replace(',', '') || '0', 10),
      bid: 0, ask: 0,
      open: parseFloat(d.open?.replace(',', '') || '0'),
      high: parseFloat(d.dayHigh?.replace(',', '') || '0'),
      low: parseFloat(d.dayLow?.replace(',', '') || '0'),
      prev_close: parseFloat(d.previousClose?.replace(',', '') || '0'),
      timestamp: Date.now(),
    };

    await cache.set(cacheKey, quote, TTL.LIVE_QUOTE);
    return quote;
  } catch (err) {
    log.error(`All quote sources failed for ${ticker}`, { err });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  FUNDAMENTALS CALCULATOR
// ═══════════════════════════════════════════════════════════════
export async function fetchLiveFundamentals(ticker: string): Promise<StockFundamentals | null> {
  const cacheKey = `fundamentals:${ticker}`;
  const cached = await cache.get<StockFundamentals>(cacheKey);
  if (cached) return cached;

  try {
    // Fetch current quote
    const quote = await fetchLiveQuote(ticker);
    if (!quote) throw new Error('No quote available');

    // Fetch stored financial data from DB (EPS, Book Value — updated quarterly)
    const { data: stockData } = await supabaseAdmin
      .from('stocks')
      .select('*')
      .eq('ticker', ticker)
      .single();

    const currentPrice = quote.ltp;
    const epsTTM = stockData?.eps_ttm ?? 0;
    const bookValue = stockData?.book_value ?? 0;
    const divYield = stockData?.div_yield ?? 0;

    const livePE = epsTTM > 0 ? parseFloat((currentPrice / epsTTM).toFixed(2)) : 0;
    const livePB = bookValue > 0 ? parseFloat((currentPrice / bookValue).toFixed(2)) : 0;

    // Market Regime Detection
    const regime = await detectMarketRegime(ticker, currentPrice);

    // Whale Activity Score
    const whaleScore = await calculateWhaleScore(ticker, quote.volume);

    const fundamentals: StockFundamentals = {
      ticker,
      company_name: stockData?.company_name ?? ticker,
      live_price: currentPrice,
      pe_ratio: livePE,
      pb_ratio: livePB,
      div_yield: divYield,
      eps_ttm: epsTTM,
      book_value: bookValue,
      market_cap: currentPrice * (stockData?.shares_outstanding ?? 0),
      fifty_two_week_high: stockData?.fifty_two_week_high ?? 0,
      fifty_two_week_low: stockData?.fifty_two_week_low ?? 0,
      market_regime: regime,
      whale_activity_score: whaleScore,
      momentum_score: await calculateMomentum(ticker),
      updated_at: new Date().toISOString(),
    };

    // Persist to DB
    await supabaseAdmin.from('stocks').upsert({
      ticker,
      live_price: currentPrice,
      pe_ratio: livePE,
      pb_ratio: livePB,
      market_regime: regime,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'ticker' });

    await cache.set(cacheKey, fundamentals, TTL.FUNDAMENTALS);

    // Push to HUD via WebSocket
    wsServer.broadcastQuote(ticker, fundamentals);

    return fundamentals;
  } catch (err) {
    log.error(`Fundamentals fetch failed for ${ticker}`, { err });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  MARKET REGIME DETECTOR
// ═══════════════════════════════════════════════════════════════
async function detectMarketRegime(ticker: string, currentPrice: number): Promise<MarketRegime> {
  try {
    // Fetch 20-day OHLC from DB or external API
    const { data: candles } = await supabaseAdmin
      .from('ohlc_data')
      .select('*')
      .eq('ticker', ticker)
      .order('time', { ascending: false })
      .limit(20);

    if (!candles || candles.length < 10) return 'RANGING';

    const closes = candles.map((c: OHLCBar) => c.close);
    const volumes = candles.map((c: OHLCBar) => c.volume);

    // Simple Moving Average 20
    const sma20 = closes.reduce((a, b) => a + b, 0) / closes.length;

    // Average True Range (volatility)
    const highs = candles.map((c: OHLCBar) => c.high);
    const lows = candles.map((c: OHLCBar) => c.low);
    const atr = highs.reduce((sum, h, i) => sum + (h - lows[i]), 0) / highs.length;
    const atrPct = (atr / currentPrice) * 100;

    // Volume surge check
    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const latestVol = volumes[0];
    const volSurge = latestVol > avgVol * 2;

    // Regime logic
    if (volSurge && Math.abs(currentPrice - closes[closes.length - 1]) / closes[closes.length - 1] > 0.03) {
      return 'BREAKOUT';
    }
    if (atrPct > 3) return 'VOLATILE';
    if (currentPrice > sma20 * 1.02) return 'TRENDING_UP';
    if (currentPrice < sma20 * 0.98) return 'TRENDING_DOWN';
    return 'RANGING';
  } catch {
    return 'RANGING';
  }
}

// ═══════════════════════════════════════════════════════════════
//  WHALE ACTIVITY SCORE
// ═══════════════════════════════════════════════════════════════
async function calculateWhaleScore(ticker: string, currentVolume: number): Promise<number> {
  try {
    const { data: avgData } = await supabaseAdmin
      .from('stocks')
      .select('avg_volume_30d')
      .eq('ticker', ticker)
      .single();

    const avgVolume = avgData?.avg_volume_30d ?? currentVolume;
    const ratio = currentVolume / avgVolume;

    // Score: 0–100 based on volume ratio vs average
    if (ratio >= 5) return 95;
    if (ratio >= 3) return 80;
    if (ratio >= 2) return 65;
    if (ratio >= 1.5) return 50;
    if (ratio >= 1.2) return 35;
    return Math.floor(ratio * 20);
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
//  MOMENTUM SCORE (0–100)
// ═══════════════════════════════════════════════════════════════
async function calculateMomentum(ticker: string): Promise<number> {
  try {
    const { data: candles } = await supabaseAdmin
      .from('ohlc_data')
      .select('close')
      .eq('ticker', ticker)
      .order('time', { ascending: false })
      .limit(14); // RSI period

    if (!candles || candles.length < 14) return 50;

    // RSI Calculation
    let gains = 0, losses = 0;
    for (let i = 0; i < candles.length - 1; i++) {
      const diff = candles[i].close - candles[i + 1].close;
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }

    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    return Math.round(rsi);
  } catch {
    return 50;
  }
}

// ═══════════════════════════════════════════════════════════════
//  BULK QUOTE FETCHER (for watchlist updates)
// ═══════════════════════════════════════════════════════════════
export async function fetchBulkQuotes(tickers: string[]): Promise<LiveQuote[]> {
  try {
    const response = await nseClient.get('/api/market-data-pre-open?key=ALL');
    const data = response.data?.data || [];

    const results: LiveQuote[] = [];
    for (const item of data) {
      if (tickers.includes(item.metadata?.symbol)) {
        const q: LiveQuote = {
          ticker: item.metadata.symbol,
          ltp: item.detail?.preOpenMarket?.IEP ?? item.metadata.lastPrice,
          change: item.metadata.change,
          change_pct: item.metadata.pChange,
          volume: item.detail?.preOpenMarket?.totalTradedVolume ?? 0,
          bid: 0, ask: 0,
          open: item.metadata.open,
          high: item.metadata.high,
          low: item.metadata.low,
          prev_close: item.metadata.previousClose,
          timestamp: Date.now(),
        };
        results.push(q);
        wsServer.broadcastQuote(q.ticker, q);
      }
    }
    return results;
  } catch (err) {
    log.error('Bulk quote fetch failed', { err });
    // Fallback to individual
    return Promise.all(tickers.map((t) => fetchLiveQuote(t))).then((r) => r.filter(Boolean) as LiveQuote[]);
  }
}

// ═══════════════════════════════════════════════════════════════
//  NIFTY 50 INDEX PULSE
// ═══════════════════════════════════════════════════════════════
export async function fetchNiftyIndex(): Promise<{ nifty50: number; sensex: number; niftyBank: number }> {
  const cacheKey = 'index:pulse';
  const cached = await cache.get<{ nifty50: number; sensex: number; niftyBank: number }>(cacheKey);
  if (cached) return cached;

  try {
    const [n50, bank] = await Promise.all([
      nseClient.get('/api/allIndices'),
      nseClient.get('/api/allIndices'),
    ]);

    const indices = n50.data?.data || [];
    const nifty50 = indices.find((i: { index: string }) => i.index === 'NIFTY 50')?.last ?? 0;
    const niftyBank = indices.find((i: { index: string }) => i.index === 'NIFTY BANK')?.last ?? 0;

    // Sensex from BSE
    let sensex = 0;
    try {
      const bse = await axios.get('https://api.bseindia.com/BseIndiaAPI/api/GetSensexData/w', { timeout: 5000 });
      sensex = parseFloat(bse.data?.IndexValue || '0');
    } catch { /* silent */ }

    const result = { nifty50, sensex, niftyBank };
    await cache.set(cacheKey, result, TTL.LIVE_QUOTE);
    return result;
  } catch (err) {
    log.error('Index fetch failed', { err });
    return { nifty50: 0, sensex: 0, niftyBank: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
//  CRON JOBS — Auto-pulse during market hours
//  NSE Market: Mon–Fri 9:15 AM – 3:30 PM IST
// ═══════════════════════════════════════════════════════════════
const WATCHLIST_TICKERS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
  'BAJFINANCE', 'ADANIPORTS', 'WIPRO', 'MARUTI', 'TITAN'];

export function startDataPulseScheduler(): void {
  // Every 5 seconds during market hours — index updates
  cron.schedule('*/5 * * * * *', async () => {
    if (!isMarketHours()) return;
    await fetchNiftyIndex();
  });

  // Every 15 seconds — watchlist fundamentals
  cron.schedule('*/15 * * * * *', async () => {
    if (!isMarketHours()) return;
    await fetchBulkQuotes(WATCHLIST_TICKERS);
  });

  // Every 1 minute — full fundamentals refresh
  cron.schedule('* * * * *', async () => {
    if (!isMarketHours()) return;
    for (const ticker of WATCHLIST_TICKERS) {
      await fetchLiveFundamentals(ticker).catch(() => null);
    }
  });

  log.engine('DATA_PULSE', 'Scheduler started');
}

function isMarketHours(): boolean {
  // Compute IST (UTC+5:30) from UTC epoch — independent of server timezone
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  const totalMin = ist.getUTCHours() * 60 + ist.getUTCMinutes();

  // 9:15 AM to 3:30 PM IST = 555 to 930 minutes from midnight
  return totalMin >= 555 && totalMin <= 930;
}
