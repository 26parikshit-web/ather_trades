// ═══════════════════════════════════════════════════════════════
//  AETHER ENGINE 3 — CHRONOS NEWS
//  Predictive News Analyzer, Sentiment Scoring, Lightning Alerts
// ═══════════════════════════════════════════════════════════════
import axios from 'axios';
import * as cheerio from 'cheerio';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../lib/supabase';
import { cache, TTL } from '../lib/cache';
import { wsServer } from '../lib/websocket';
import { log } from '../lib/logger';
import { geminiJSON } from '../lib/ai';
import { NewsImpact, NewsCategory } from '../types';

interface ChronosAIOutput {
  sentiment_score?: number;
  predicted_move?: number;
  confidence_score?: number;
  impact_weight?: number;
  affected_tickers?: string[];
  sector?: string;
  category?: NewsCategory;
  impact_duration?: NewsImpact['impact_duration'];
  summary?: string;
  contrarian_view?: string;
  key_levels_to_watch?: string;
}

// ─── News Sources ────────────────────────────────────────────
const NEWS_SOURCES = [
  { name: 'MoneyControl', url: 'https://www.moneycontrol.com/rss/latestnews.xml' },
  { name: 'ET Markets', url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
  { name: 'LiveMint', url: 'https://www.livemint.com/rss/markets' },
  { name: 'BusinessStandard', url: 'https://www.business-standard.com/rss/latest.rss' },
  { name: 'NSE Announcements', url: 'https://www.nseindia.com/api/corporate-announcements?index=equities' },
];

// ═══════════════════════════════════════════════════════════════
//  HEADLINE ANALYZER — Core AI function
// ═══════════════════════════════════════════════════════════════
export async function analyzeNewsImpact(
  headline: string,
  source: string = 'Manual',
  url: string = ''
): Promise<NewsImpact | null> {
  const cacheKey = `news:analyze:${Buffer.from(headline).toString('base64').slice(0, 40)}`;
  const cached = await cache.get<NewsImpact>(cacheKey);
  if (cached) return cached;

  try {
    const systemPrompt = `You are CHRONOS — AETHER's predictive news intelligence engine for the Indian stock market.
You analyze news headlines and predict their market impact with precision.
Respond ONLY with valid JSON. Be analytical and data-driven.`;

    const userPrompt = `Analyze this Indian Stock Market news headline and predict its tactical market reaction.

HEADLINE: "${headline}"

Provide a JSON response with EXACTLY this structure:
{
  "sentiment_score": <-1.0 to 1.0>,
  "predicted_move": <percentage change, e.g. 2.3 or -1.5>,
  "confidence_score": <0 to 100>,
  "impact_weight": <1 to 100>,
  "affected_tickers": ["TICKER1", "TICKER2"],
  "sector": "<e.g. BANKING, IT, PHARMA, AUTO, FMCG, ENERGY, METALS>",
  "category": "EARNINGS" | "MACRO" | "RBI_POLICY" | "SEBI_REGULATION" | "FII_DII" | "SECTOR_NEWS" | "GLOBAL_CUES" | "CORPORATE_ACTION",
  "impact_duration": "INTRADAY" | "SHORT_TERM_1W" | "MEDIUM_TERM_1M",
  "summary": "<2-sentence tactical interpretation>",
  "contrarian_view": "<1 sentence opposing view>",
  "key_levels_to_watch": "<price levels or index levels affected>"
}`;

    const ai = await geminiJSON<ChronosAIOutput>(systemPrompt, userPrompt, {
      temperature: 0.2,
      maxTokens: 600,
    });

    const newsImpact: NewsImpact = {
      id: uuidv4(),
      headline,
      source,
      url,
      sentiment_score: Math.max(-1, Math.min(1, ai.sentiment_score || 0)),
      predicted_move: ai.predicted_move || 0,
      confidence_score: Math.min(100, Math.max(0, ai.confidence_score || 0)),
      impact_weight: Math.min(100, Math.max(1, ai.impact_weight || 1)),
      affected_tickers: ai.affected_tickers || [],
      sector: ai.sector || 'BROAD_MARKET',
      category: (ai.category as NewsCategory) || 'MACRO',
      created_at: new Date().toISOString(),
    };

    // Store in DB (the "lightning bolt" source for the HUD)
    await supabaseAdmin.from('news_impact').insert({
      ...newsImpact,
      impact_duration: ai.impact_duration,
      summary: ai.summary,
      contrarian_view: ai.contrarian_view,
      key_levels_to_watch: ai.key_levels_to_watch,
    });

    await cache.set(cacheKey, newsImpact, TTL.NEWS);

    // Broadcast to all subscribers (all tiers)
    wsServer.broadcastNews(newsImpact);

    // Trigger Whale Alert if high-impact (ELITE only)
    if (newsImpact.impact_weight >= 80 || Math.abs(newsImpact.predicted_move) >= 3) {
      wsServer.broadcastWhaleAlert({
        type: 'HIGH_IMPACT_NEWS',
        headline,
        predicted_move: newsImpact.predicted_move,
        affected_tickers: newsImpact.affected_tickers,
        impact_weight: newsImpact.impact_weight,
      });
    }

    log.engine('CHRONOS', `News analyzed: sentiment=${newsImpact.sentiment_score}, predicted_move=${newsImpact.predicted_move}%`);
    return newsImpact;
  } catch (err) {
    log.error('News analysis failed', { err, headline });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  RSS FEED SCRAPER
// ═══════════════════════════════════════════════════════════════
async function scrapeRSSFeed(sourceUrl: string, sourceName: string): Promise<Array<{ headline: string; url: string }>> {
  try {
    const response = await axios.get(sourceUrl, {
      headers: { 'User-Agent': 'AETHER-Bot/1.0' },
      timeout: 8_000,
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items: Array<{ headline: string; url: string }> = [];

    $('item').each((_, el) => {
      const headline = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim() || $(el).find('guid').text().trim();
      if (headline && headline.length > 20) {
        items.push({ headline, url: link });
      }
    });

    return items.slice(0, 10); // Top 10 latest
  } catch (err) {
    log.warn(`RSS scrape failed: ${sourceName}`, { err });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
//  NSE CORPORATE ANNOUNCEMENTS FETCHER
// ═══════════════════════════════════════════════════════════════
async function fetchNSEAnnouncements(): Promise<Array<{ headline: string; url: string }>> {
  try {
    const response = await axios.get(
      'https://www.nseindia.com/api/corporate-announcements?index=equities',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.nseindia.com/',
        },
        timeout: 8_000,
      }
    );

    const announcements = response.data?.data || [];
    return announcements
      .slice(0, 20)
      .map((a: { desc: string; symbol: string; attchmntFile: string }) => ({
        headline: `[${a.symbol}] ${a.desc}`,
        url: a.attchmntFile || `https://www.nseindia.com/companies-listing/corporate-filings-announcements`,
      }));
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
//  DUPLICATE DETECTOR — Avoid re-analyzing same news
// ═══════════════════════════════════════════════════════════════
async function isNewsAlreadyProcessed(headline: string): Promise<boolean> {
  // Check last 6 hours in DB
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('news_impact')
    .select('id', { count: 'exact', head: true })
    .ilike('headline', `%${headline.slice(0, 60)}%`)
    .gte('created_at', since);

  return (count ?? 0) > 0;
}

// ═══════════════════════════════════════════════════════════════
//  BATCH NEWS PROCESSOR (Called by cron)
// ═══════════════════════════════════════════════════════════════
export async function runNewsScan(): Promise<number> {
  let processedCount = 0;

  try {
    // Gather all headlines
    const allItems: Array<{ headline: string; url: string; source: string }> = [];

    for (const source of NEWS_SOURCES) {
      if (source.name === 'NSE Announcements') {
        const announcements = await fetchNSEAnnouncements();
        allItems.push(...announcements.map((a) => ({ ...a, source: source.name })));
      } else {
        const rssItems = await scrapeRSSFeed(source.url, source.name);
        allItems.push(...rssItems.map((a) => ({ ...a, source: source.name })));
      }
    }

    // Filter for market-relevant keywords
    const marketKeywords = [
      'nifty', 'sensex', 'rbi', 'sebi', 'earnings', 'results', 'quarterly',
      'merger', 'acquisition', 'ipo', 'fii', 'dii', 'interest rate', 'inflation',
      'gdp', 'crude', 'dollar', 'rupee', 'stock', 'share', 'market',
      'dividend', 'bonus', 'split', 'buyback', 'rights issue',
    ];

    const relevantItems = allItems.filter((item) => {
      const lower = item.headline.toLowerCase();
      return marketKeywords.some((kw) => lower.includes(kw));
    });

    log.engine('CHRONOS', `Found ${relevantItems.length} relevant headlines from ${allItems.length} total`);

    // Analyze each (with rate limiting)
    for (const item of relevantItems) {
      const alreadyDone = await isNewsAlreadyProcessed(item.headline);
      if (alreadyDone) continue;

      await analyzeNewsImpact(item.headline, item.source, item.url);
      processedCount++;
      await new Promise((r) => setTimeout(r, 800)); // Rate limit: ~75 req/min
    }

    log.engine('CHRONOS', `News scan complete: ${processedCount} new headlines analyzed`);
    return processedCount;
  } catch (err) {
    log.error('News scan failed', { err });
    return processedCount;
  }
}

// ═══════════════════════════════════════════════════════════════
//  GET LATEST NEWS FEED (for API)
// ═══════════════════════════════════════════════════════════════
export async function getLatestNewsFeed(
  limit = 20,
  category?: string,
  minImpact = 0
): Promise<NewsImpact[]> {
  const cacheKey = `news:feed:${limit}:${category}:${minImpact}`;
  const cached = await cache.get<NewsImpact[]>(cacheKey);
  if (cached) return cached;

  let query = supabaseAdmin
    .from('news_impact')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (category) query = query.eq('category', category);
  if (minImpact > 0) query = query.gte('impact_weight', minImpact);

  const { data } = await query;
  const result = (data as NewsImpact[]) || [];

  await cache.set(cacheKey, result, TTL.NEWS);
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  CRON SCHEDULER
// ═══════════════════════════════════════════════════════════════
export function startChronosScheduler(): void {
  // Every 5 minutes during extended hours (8 AM – 6 PM IST)
  cron.schedule('*/5 * * * *', async () => {
    const hour = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours(); // IST
    if (hour >= 8 && hour <= 18) {
      await runNewsScan();
    }
  });

  log.engine('CHRONOS', 'Scheduler started');
}
