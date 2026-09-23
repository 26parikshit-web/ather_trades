// ═══════════════════════════════════════════════════════════════
//  AETHER ENGINE 2 — ORACLE BRAIN
//  AI Signal Generation, Hover Intelligence, Vector Search
// ═══════════════════════════════════════════════════════════════
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../lib/supabase';
import { cache, TTL } from '../lib/cache';
import { wsServer } from '../lib/websocket';
import { log } from '../lib/logger';
import { geminiGenerate, geminiJSON, hfEmbedding } from '../lib/ai';
import { fetchLiveFundamentals } from './data-pulse';
import { OracleSignal, VectorSearchResult } from '../types';

interface OracleAIOutput {
  signal_type?: OracleSignal['signal_type'];
  confidence?: number;
  entry_zone_low?: number;
  entry_zone_high?: number;
  stop_loss?: number;
  target_1?: number;
  target_2?: number;
  target_3?: number;
  risk_reward_ratio?: number;
  rationale?: string;
  key_risks?: string[];
  time_horizon?: OracleSignal['time_horizon'];
  catalyst?: string;
}

// ═══════════════════════════════════════════════════════════════
//  ORACLE SIGNAL GENERATOR
//  The core AI — produces actionable BUY/SELL/WATCH signals
// ═══════════════════════════════════════════════════════════════
export async function generateOracleSignal(ticker: string): Promise<OracleSignal | null> {
  const cacheKey = `oracle:signal:${ticker}`;
  const cached = await cache.get<OracleSignal>(cacheKey);
  if (cached) return cached;

  try {
    // 1. Gather all context for the AI
    const fundamentals = await fetchLiveFundamentals(ticker);
    if (!fundamentals) throw new Error('No fundamentals available');

    // 2. Fetch recent news context from DB
    const { data: recentNews } = await supabaseAdmin
      .from('news_impact')
      .select('headline, sentiment_score, predicted_move')
      .contains('affected_tickers', [ticker])
      .order('created_at', { ascending: false })
      .limit(5);

    // 3. Fetch historical Oracle signals for context
    const { data: pastSignals } = await supabaseAdmin
      .from('oracle_signals')
      .select('signal_type, confidence, entry_zone_low, entry_zone_high, target_1')
      .eq('ticker', ticker)
      .order('generated_at', { ascending: false })
      .limit(3);

    // 4. Build the ORACLE prompt
    const systemPrompt = `You are ORACLE — AETHER's elite quantitative AI for the Indian stock market (NSE/BSE).
You analyze fundamentals, technicals, news sentiment, and market regime to generate high-conviction tactical signals.
You MUST respond with ONLY valid JSON. No explanation text outside the JSON.
Your risk-reward discipline: minimum 1:2 RR ratio. Only generate signals you'd bet your own capital on.`;

    const userPrompt = `Analyze ${ticker} and generate a trading signal.

LIVE DATA:
- Price: ₹${fundamentals.live_price}
- PE Ratio: ${fundamentals.pe_ratio} (sector avg comparison)
- PB Ratio: ${fundamentals.pb_ratio}
- 52W High: ₹${fundamentals.fifty_two_week_high} | 52W Low: ₹${fundamentals.fifty_two_week_low}
- Market Regime: ${fundamentals.market_regime}
- Whale Activity Score: ${fundamentals.whale_activity_score}/100
- Momentum Score (RSI): ${fundamentals.momentum_score}
- Dividend Yield: ${fundamentals.div_yield}%

RECENT NEWS SENTIMENT:
${recentNews?.map((n) => `- "${n.headline}" | Sentiment: ${n.sentiment_score} | Predicted Move: ${n.predicted_move}%`).join('\n') || 'No recent news'}

PAST ORACLE SIGNALS: ${JSON.stringify(pastSignals || [])}

Generate a JSON response with this EXACT structure:
{
  "signal_type": "BUY" | "SELL" | "WATCH" | "AVOID",
  "confidence": <0-100>,
  "entry_zone_low": <price>,
  "entry_zone_high": <price>,
  "stop_loss": <price>,
  "target_1": <price>,
  "target_2": <price>,
  "target_3": <price>,
  "risk_reward_ratio": <number>,
  "rationale": "<3-sentence tactical explanation>",
  "key_risks": ["<risk1>", "<risk2>"],
  "time_horizon": "INTRADAY" | "SWING_3_5D" | "POSITIONAL_2_4W",
  "catalyst": "<what would trigger this move>"
}`;

    // 5. Call Gemini (free tier)
    const aiOutput = await geminiJSON<OracleAIOutput>(systemPrompt, userPrompt, {
      temperature: 0.3,   // Low temp for consistency
      maxTokens: 800,
    });
    const rawContent = JSON.stringify(aiOutput);

    // 6. Validate and construct signal
    const signal: OracleSignal = {
      id: uuidv4(),
      ticker,
      signal_type: aiOutput.signal_type || 'WATCH',
      confidence: Math.min(100, Math.max(0, aiOutput.confidence || 0)),
      entry_zone_low: aiOutput.entry_zone_low || fundamentals.live_price * 0.99,
      entry_zone_high: aiOutput.entry_zone_high || fundamentals.live_price * 1.01,
      stop_loss: aiOutput.stop_loss || fundamentals.live_price * 0.95,
      target_1: aiOutput.target_1 || fundamentals.live_price * 1.05,
      target_2: aiOutput.target_2 || fundamentals.live_price * 1.08,
      target_3: aiOutput.target_3 || fundamentals.live_price * 1.12,
      rationale: aiOutput.rationale || '',
      risk_reward_ratio: aiOutput.risk_reward_ratio || 0,
      generated_at: new Date().toISOString(),
      expiry: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4hr expiry
    };

    // 7. Store in DB
    await supabaseAdmin.from('oracle_signals').insert({
      ...signal,
      key_risks: aiOutput.key_risks,
      time_horizon: aiOutput.time_horizon,
      catalyst: aiOutput.catalyst,
      raw_response: rawContent,
    });

    await cache.set(cacheKey, signal, TTL.ORACLE_SIGNAL);

    // 8. Broadcast to WebSocket subscribers (PRO + ELITE)
    wsServer.broadcastSignal(signal);

    log.engine('ORACLE', `Signal generated: ${signal.signal_type} ${ticker} (conf: ${signal.confidence}%)`);
    return signal;
  } catch (err) {
    log.error(`Oracle signal failed for ${ticker}`, { err });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  HOVER INTELLIGENCE — Quick AI insight on demand
//  Called when user hovers over a stock on the HUD
// ═══════════════════════════════════════════════════════════════
export async function getHoverIntelligence(ticker: string): Promise<string> {
  const cacheKey = `oracle:hover:${ticker}`;
  const cached = await cache.get<string>(cacheKey);
  if (cached) return cached;

  try {
    const fundamentals = await fetchLiveFundamentals(ticker);
    if (!fundamentals) return 'Insufficient data for analysis.';

    const insight = await geminiGenerate(
      'You are ORACLE. Give a crisp 2-sentence tactical insight for a stock. Be direct, specific, data-driven. Sound like a seasoned quant.',
      `Quick insight on ${ticker}: Price ₹${fundamentals.live_price}, PE ${fundamentals.pe_ratio}, PB ${fundamentals.pb_ratio}, Regime: ${fundamentals.market_regime}, Whale Score: ${fundamentals.whale_activity_score}/100, RSI: ${fundamentals.momentum_score}.`,
      { temperature: 0.4, maxTokens: 120 }
    );

    const result = insight || 'Analysis unavailable.';
    await cache.set(cacheKey, result, 300); // Cache 5 min
    return result;
  } catch (err) {
    log.error(`Hover intelligence failed for ${ticker}`, { err });
    return 'Analysis temporarily unavailable.';
  }
}

// ═══════════════════════════════════════════════════════════════
//  VECTOR SEARCH — Find similar stock patterns
//  Finds historically similar market setups using embeddings
// ═══════════════════════════════════════════════════════════════
export async function findSimilarStocks(ticker: string, context: string): Promise<VectorSearchResult[]> {
  try {
    // Generate embedding via HuggingFace (free)
    const queryEmbedding = await hfEmbedding(context);
    if (!queryEmbedding) return [];

    // Use pgvector in Supabase for similarity search
    const { data: results } = await supabaseAdmin.rpc('search_similar_stocks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.75,
      match_count: 5,
    });

    return (results || []).map((r: { ticker: string; similarity: number; context: string }) => ({
      ticker: r.ticker,
      similarity: r.similarity,
      context: r.context,
    }));
  } catch (err) {
    log.error('Vector search failed', { err });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
//  PORTFOLIO AI REVIEW
//  Analyses entire user portfolio and gives rebalancing advice
// ═══════════════════════════════════════════════════════════════
export async function reviewPortfolioWithAI(userId: string): Promise<string> {
  try {
    // Fetch user's portfolio
    const { data: holdings } = await supabaseAdmin
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', userId);

    if (!holdings || holdings.length === 0) {
      return 'No holdings found to analyze.';
    }

    // Enrich with live prices
    const enriched = await Promise.all(
      holdings.map(async (h) => {
        const quote = await fetchLiveFundamentals(h.ticker).catch(() => null);
        return {
          ...h,
          current_price: quote?.live_price ?? h.avg_buy_price,
          pe: quote?.pe_ratio ?? 'N/A',
          regime: quote?.market_regime ?? 'UNKNOWN',
        };
      })
    );

    const review = await geminiGenerate(
      'You are ORACLE reviewing a portfolio. Be direct, tactical, and honest. Maximum 200 words.',
      `Review this portfolio and give rebalancing recommendations:\n${JSON.stringify(enriched, null, 2)}`,
      { temperature: 0.4, maxTokens: 400 }
    );

    return review || 'Review unavailable.';
  } catch (err) {
    log.error('Portfolio AI review failed', { err });
    return 'AI review temporarily unavailable.';
  }
}

// ═══════════════════════════════════════════════════════════════
//  BATCH SIGNAL SCANNER
//  Runs Oracle on all watchlist stocks (called by cron)
// ═══════════════════════════════════════════════════════════════
export async function runSignalScan(tickers: string[]): Promise<OracleSignal[]> {
  const signals: OracleSignal[] = [];

  for (const ticker of tickers) {
    const signal = await generateOracleSignal(ticker).catch(() => null);
    if (signal && signal.confidence >= 65) {
      signals.push(signal);
    }
    // Rate limiting handled centrally in lib/ai.ts (Gemini free tier)
  }

  log.engine('ORACLE', `Signal scan complete: ${signals.length}/${tickers.length} high-confidence signals`);
  return signals;
}
