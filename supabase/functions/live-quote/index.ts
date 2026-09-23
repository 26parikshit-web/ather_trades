// ═══════════════════════════════════════════════════════════════
//  AETHER — Supabase Edge Function: live-quote
//  Ultra-low-latency NSE quote proxy (Deno runtime).
//  Deploy: supabase functions deploy live-quote
//  Call:   GET /functions/v1/live-quote?ticker=RELIANCE
// ═══════════════════════════════════════════════════════════════
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const NSE_HEADERS = {
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.nseindia.com/',
  'X-Requested-With': 'XMLHttpRequest',
};

interface LiveQuote {
  ticker: string;
  ltp: number;
  change: number;
  change_pct: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  prev_close: number;
  timestamp: number;
}

serve(async (req: Request): Promise<Response> => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const url = new URL(req.url);
    const ticker = (url.searchParams.get('ticker') || '').toUpperCase();

    if (!ticker || !/^[A-Z0-9&]{1,20}$/.test(ticker)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid ?ticker= symbol required' }),
        { status: 400, headers: cors }
      );
    }

    const nseRes = await fetch(
      `https://www.nseindia.com/api/quote-equity?symbol=${ticker}`,
      { headers: NSE_HEADERS }
    );

    if (!nseRes.ok) {
      throw new Error(`NSE responded ${nseRes.status}`);
    }

    const d = await nseRes.json();
    const quote: LiveQuote = {
      ticker,
      ltp: d.priceInfo?.lastPrice ?? 0,
      change: d.priceInfo?.change ?? 0,
      change_pct: d.priceInfo?.pChange ?? 0,
      volume: d.tradeInfo?.totalTradedVolume ?? 0,
      open: d.priceInfo?.open ?? 0,
      high: d.priceInfo?.intraDayHighLow?.max ?? 0,
      low: d.priceInfo?.intraDayHighLow?.min ?? 0,
      prev_close: d.priceInfo?.previousClose ?? 0,
      timestamp: Date.now(),
    };

    return new Response(JSON.stringify({ success: true, data: quote }), {
      headers: { ...cors, 'Cache-Control': 'public, max-age=3' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 502, headers: cors }
    );
  }
});
