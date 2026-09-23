// ═══════════════════════════════════════════════════════════════
//  AETHER ENGINE 4 — PULSE STUDIO (FREE EDITION)
//  AI caption generation via Gemini. Social video rendering and
//  Instagram/YouTube auto-posting are DISABLED (paid APIs removed).
//  Signal cards are stored in broadcast_logs for manual posting.
// ═══════════════════════════════════════════════════════════════
import cron from 'node-cron';
import { supabaseAdmin } from '../lib/supabase';
import { log } from '../lib/logger';
import { geminiGenerate } from '../lib/ai';
import { BroadcastPayload, SocialPostResult } from '../types';

// ═══════════════════════════════════════════════════════════════
//  CAPTION GENERATOR — AI-written social copy (Gemini, free)
// ═══════════════════════════════════════════════════════════════
export async function generateSocialCaption(payload: BroadcastPayload): Promise<string> {
  const fallback = `🚨 AETHER SIGNAL: ${payload.ticker} ${payload.signal_type}\nConfidence: ${payload.confidence}% | Target: ₹${payload.target} | SL: ₹${payload.stop_loss}\n#StockMarket #NSE #Nifty #AETHER`;

  try {
    const caption = await geminiGenerate(
      `You are AETHER's social media voice — authoritative, data-driven, viral-worthy.
Write Instagram captions for Indian stock market signals. Use emojis strategically.
End with relevant hashtags. Max 300 characters for caption text + 10 hashtags.`,
      `Write an Instagram Reel caption for this signal:
Stock: ${payload.ticker}
Signal: ${payload.signal_type}
Confidence: ${payload.confidence}%
Target: ₹${payload.target}
Stop Loss: ₹${payload.stop_loss}
PE: ${payload.pe}
Rationale: ${payload.rationale}`,
      { temperature: 0.7, maxTokens: 400 }
    );

    return caption || fallback;
  } catch (err) {
    log.error('Caption generation failed', { err });
    return fallback;
  }
}


// ═══════════════════════════════════════════════════════════════
//  SIGNAL CARD — Text card stored for manual posting
//  (Shotstack video rendering removed — paid API)
// ═══════════════════════════════════════════════════════════════
export function buildSignalCardText(payload: BroadcastPayload, caption: string): string {
  return [
    'AETHER SIGNAL CARD',
    `---------------------`,
    `${payload.ticker} — ${payload.signal_type}`,
    `Target: Rs.${payload.target}`,
    `Stop Loss: Rs.${payload.stop_loss}`,
    `Confidence: ${payload.confidence}%`,
    `PE: ${payload.pe} | PB: ${payload.pb}`,
    `---------------------`,
    caption,
    'NOT FINANCIAL ADVICE - DYOR',
  ].join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  MASTER BROADCASTER — Free pipeline
//  1. Caption (Gemini) -> 2. Signal card -> 3. Log to DB
//  Social auto-posting is stubbed out (paid APIs removed).
// ═══════════════════════════════════════════════════════════════
export async function autoBroadcastAlpha(payload: BroadcastPayload): Promise<SocialPostResult[]> {
  log.engine('PULSE', `Starting broadcast pipeline for ${payload.ticker}`);

  // 1. Generate caption (Gemini — free)
  const caption = await generateSocialCaption(payload);

  // 2. Build a text signal card (replaces Shotstack video)
  const card = buildSignalCardText(payload, caption);

  // 3. Social posting disabled
  const results: SocialPostResult[] = [];

  // 4. Log broadcast to DB (caption column stores the text card)
  await supabaseAdmin.from('broadcast_logs').insert({
    ticker: payload.ticker,
    signal_type: payload.signal_type,
    video_url: null,
    caption: card,
    instagram_post_id: null,
    instagram_url: null,
    instagram_status: 'DISABLED',
    youtube_post_id: null,
    youtube_url: null,
    youtube_status: 'DISABLED',
    broadcasted_at: new Date().toISOString(),
  });

  log.engine('PULSE', `Broadcast logged for ${payload.ticker} (social posting disabled — free mode)`);
  return results;
}

// ═══════════════════════════════════════════════════════════════
//  SCHEDULED DAILY MARKET RECAP
//  Generates a daily market summary at 4:15 PM IST automatically
// ═══════════════════════════════════════════════════════════════
export async function broadcastDailyRecap(): Promise<void> {
  try {
    const { data: topSignals } = await supabaseAdmin
      .from('oracle_signals')
      .select('ticker, signal_type, confidence, target_1')
      .gte('generated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .gte('confidence', 70)
      .order('confidence', { ascending: false })
      .limit(3);

    if (!topSignals || topSignals.length === 0) {
      log.engine('PULSE', 'No high-confidence signals for daily recap');
      return;
    }

    const recapCaption = await geminiGenerate(
      'Write a short, punchy daily market recap for Instagram. Max 200 words. Use emojis. Include hashtags.',
      `Today's AETHER top signals:\n${JSON.stringify(topSignals, null, 2)}\n\nWrite an engaging recap.`,
      { temperature: 0.6, maxTokens: 300 }
    );

    const topSignal = topSignals[0];
    await autoBroadcastAlpha({
      ticker: topSignal.ticker,
      signal_type: topSignal.signal_type,
      pe: 0,
      pb: 0,
      confidence: topSignal.confidence,
      target: topSignal.target_1,
      stop_loss: 0,
      rationale: recapCaption || 'Market recap unavailable.',
    });
  } catch (err) {
    log.error('Daily recap broadcast failed', { err });
  }
}

// ═══════════════════════════════════════════════════════════════
//  CRON SCHEDULER
// ═══════════════════════════════════════════════════════════════
export function startPulseStudioScheduler(): void {
  // Daily recap at 4:15 PM IST (10:45 UTC)
  cron.schedule('45 10 * * 1-5', async () => {
    await broadcastDailyRecap();
  });

  log.engine('PULSE', 'Scheduler started — Daily recap at 4:15 PM IST (free mode: captions only)');
}
