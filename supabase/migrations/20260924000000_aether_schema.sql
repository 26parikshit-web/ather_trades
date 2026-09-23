-- ═══════════════════════════════════════════════════════════════
--  AETHER — Supabase migration (linked project lbsxhmffqorkgwyxghqw)
--  Applied via: supabase db push
-- ═══════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ═══════════════════════════════════════════════════════════════
--  TABLE 1: PROFILES (Users & Subscription Tiers)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email               TEXT,
  name                TEXT,
  subscription_tier   TEXT NOT NULL DEFAULT 'BASIC'
                      CHECK (subscription_tier IN ('BASIC', 'PRO', 'ELITE')),
  trial_start_date    TIMESTAMPTZ DEFAULT NOW(),
  is_trial_active     BOOLEAN DEFAULT TRUE,
  stripe_customer_id  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ═══════════════════════════════════════════════════════════════
--  TABLE 2: STOCKS (Fundamentals + Live Data)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS stocks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker               TEXT UNIQUE NOT NULL,
  company_name         TEXT NOT NULL,
  sector               TEXT,
  industry             TEXT,
  isin                 TEXT,
  exchange             TEXT DEFAULT 'NSE',

  -- Live price data (updated by Data Pulse engine)
  live_price           DECIMAL(12,2) DEFAULT 0,
  pe_ratio             DECIMAL(10,2),
  pb_ratio             DECIMAL(10,2),
  div_yield            DECIMAL(6,2),

  -- Fundamentals (updated quarterly from filings)
  eps_ttm              DECIMAL(10,2),
  book_value           DECIMAL(10,2),
  shares_outstanding   BIGINT,
  market_cap           DECIMAL(20,2),
  revenue_ttm          DECIMAL(20,2),
  net_profit_ttm       DECIMAL(20,2),
  debt_to_equity       DECIMAL(10,2),
  roe                  DECIMAL(8,2),
  roce                 DECIMAL(8,2),

  -- 52-week range
  fifty_two_week_high  DECIMAL(12,2),
  fifty_two_week_low   DECIMAL(12,2),

  -- Volume analytics
  avg_volume_30d       BIGINT,
  whale_activity_score INT DEFAULT 0 CHECK (whale_activity_score BETWEEN 0 AND 100),
  momentum_score       INT DEFAULT 50 CHECK (momentum_score BETWEEN 0 AND 100),

  -- Market regime (updated by Data Pulse)
  market_regime        TEXT DEFAULT 'RANGING'
                       CHECK (market_regime IN ('TRENDING_UP','TRENDING_DOWN','RANGING','VOLATILE','BREAKOUT')),

  -- Vector embedding for Oracle AI similarity search (HuggingFace MiniLM, 384 dims)
  embedding            vector(384),

  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stocks_ticker ON stocks(ticker);
CREATE INDEX IF NOT EXISTS idx_stocks_regime ON stocks(market_regime);
CREATE INDEX IF NOT EXISTS idx_stocks_whale  ON stocks(whale_activity_score DESC);
CREATE INDEX IF NOT EXISTS idx_stocks_embed  ON stocks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- ═══════════════════════════════════════════════════════════════
--  TABLE 3: OHLC DATA (Candlestick history)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ohlc_data (
  id        BIGSERIAL PRIMARY KEY,
  ticker    TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
  time      TIMESTAMPTZ NOT NULL,
  open      DECIMAL(12,2) NOT NULL,
  high      DECIMAL(12,2) NOT NULL,
  low       DECIMAL(12,2) NOT NULL,
  close     DECIMAL(12,2) NOT NULL,
  volume    BIGINT NOT NULL DEFAULT 0,
  interval  TEXT DEFAULT '1D' CHECK (interval IN ('1m','5m','15m','1H','4H','1D','1W'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ohlc_ticker_time_interval
  ON ohlc_data(ticker, time, interval);
CREATE INDEX IF NOT EXISTS idx_ohlc_ticker_time ON ohlc_data(ticker, time DESC);


-- ═══════════════════════════════════════════════════════════════
--  TABLE 4: ORACLE SIGNALS (AI-Generated Trading Signals)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS oracle_signals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker            TEXT NOT NULL,
  signal_type       TEXT NOT NULL CHECK (signal_type IN ('BUY','SELL','WATCH','AVOID')),
  confidence        INT CHECK (confidence BETWEEN 0 AND 100),
  entry_zone_low    DECIMAL(12,2),
  entry_zone_high   DECIMAL(12,2),
  stop_loss         DECIMAL(12,2),
  target_1          DECIMAL(12,2),
  target_2          DECIMAL(12,2),
  target_3          DECIMAL(12,2),
  risk_reward_ratio DECIMAL(6,2),
  rationale         TEXT,
  key_risks         TEXT[],
  time_horizon      TEXT CHECK (time_horizon IN ('INTRADAY','SWING_3_5D','POSITIONAL_2_4W')),
  catalyst          TEXT,
  raw_response      TEXT,

  -- Outcome tracking (filled after signal expires)
  actual_outcome    TEXT,
  actual_move_pct   DECIMAL(8,2),
  was_accurate      BOOLEAN,

  generated_at      TIMESTAMPTZ DEFAULT NOW(),
  expiry            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_signals_ticker      ON oracle_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_signals_generated   ON oracle_signals(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_confidence  ON oracle_signals(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_signals_type        ON oracle_signals(signal_type);


-- ═══════════════════════════════════════════════════════════════
--  TABLE 5: NEWS IMPACT (Chronos Analyzed Headlines)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS news_impact (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline          TEXT NOT NULL,
  source            TEXT,
  url               TEXT,
  sentiment_score   DECIMAL(4,2) CHECK (sentiment_score BETWEEN -1 AND 1),
  predicted_move    DECIMAL(6,2),
  confidence_score  INT CHECK (confidence_score BETWEEN 0 AND 100),
  impact_weight     INT CHECK (impact_weight BETWEEN 1 AND 100),
  affected_tickers  TEXT[],
  sector            TEXT,
  category          TEXT CHECK (category IN (
                      'EARNINGS','MACRO','RBI_POLICY','SEBI_REGULATION',
                      'FII_DII','SECTOR_NEWS','GLOBAL_CUES','CORPORATE_ACTION'
                    )),
  impact_duration   TEXT,
  summary           TEXT,
  contrarian_view   TEXT,
  key_levels_to_watch TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_created    ON news_impact(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_sentiment  ON news_impact(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_news_impact     ON news_impact(impact_weight DESC);
CREATE INDEX IF NOT EXISTS idx_news_tickers    ON news_impact USING GIN(affected_tickers);


-- ═══════════════════════════════════════════════════════════════
--  TABLE 6: PORTFOLIO HOLDINGS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ticker         TEXT NOT NULL,
  quantity       DECIMAL(12,4) NOT NULL,
  avg_buy_price  DECIMAL(12,2) NOT NULL,
  notes          TEXT,
  added_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_holdings(user_id);


-- ═══════════════════════════════════════════════════════════════
--  TABLE 7: BROADCAST LOGS (Pulse Studio audit trail)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS broadcast_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker             TEXT,
  signal_type        TEXT,
  video_url          TEXT,
  caption            TEXT,
  instagram_post_id  TEXT,
  instagram_url      TEXT,
  instagram_status   TEXT,
  youtube_post_id    TEXT,
  youtube_url        TEXT,
  youtube_status     TEXT,
  broadcasted_at     TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════
--  TABLE 8: WATCHLISTS
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS watchlists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'My Watchlist',
  tickers    TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlists(user_id);


-- ═══════════════════════════════════════════════════════════════
--  FUNCTION: Vector Similarity Search (Oracle Brain)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION search_similar_stocks(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  ticker     TEXT,
  similarity FLOAT,
  context    TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.ticker,
    1 - (s.embedding <=> query_embedding) AS similarity,
    CONCAT(
      'PE:', s.pe_ratio,
      ' PB:', s.pb_ratio,
      ' Regime:', s.market_regime,
      ' Whale:', s.whale_activity_score
    ) AS context
  FROM stocks s
  WHERE s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

-- Profiles: users can only see/edit their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Portfolio: users see only their holdings
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own portfolio" ON portfolio_holdings
  FOR ALL USING (auth.uid() = user_id);

-- Watchlists: users see only their own
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own watchlists" ON watchlists
  FOR ALL USING (auth.uid() = user_id);

-- Stocks, News, Signals: public read (all authenticated users)
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read stocks" ON stocks
  FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE oracle_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read signals" ON oracle_signals
  FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE news_impact ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read news" ON news_impact
  FOR SELECT USING (auth.role() = 'authenticated');


-- ═══════════════════════════════════════════════════════════════
--  SEED DATA — Nifty 50 Core Stocks
-- ═══════════════════════════════════════════════════════════════
INSERT INTO stocks (ticker, company_name, sector, exchange, eps_ttm, book_value, shares_outstanding, fifty_two_week_high, fifty_two_week_low, avg_volume_30d)
VALUES
  ('RELIANCE',   'Reliance Industries Ltd',     'ENERGY',      'NSE', 98.5,  1120.3, 6766388000, 3217.90, 2180.55, 8500000),
  ('TCS',        'Tata Consultancy Services',    'IT',          'NSE', 118.0,  380.2, 3642800000, 4592.25, 3311.10, 3200000),
  ('INFY',       'Infosys Ltd',                  'IT',          'NSE', 60.2,   198.5, 4160000000, 1970.00, 1358.35, 9800000),
  ('HDFCBANK',   'HDFC Bank Ltd',                'BANKING',     'NSE', 85.4,   555.8, 7525000000, 1880.00, 1363.55, 12000000),
  ('ICICIBANK',  'ICICI Bank Ltd',               'BANKING',     'NSE', 48.2,   332.1, 7025000000, 1322.40,  889.00, 15000000),
  ('BAJFINANCE', 'Bajaj Finance Ltd',            'NBFC',        'NSE', 215.0, 1085.4,  602000000, 8192.00, 6187.80,  2500000),
  ('WIPRO',      'Wipro Ltd',                    'IT',          'NSE', 22.8,   125.6, 5265000000,  578.70,  392.50,  6500000),
  ('MARUTI',     'Maruti Suzuki India Ltd',      'AUTO',        'NSE', 520.0, 2890.5,  302000000,13680.00, 9273.00,   800000),
  ('TITAN',      'Titan Company Ltd',            'CONSUMER',    'NSE', 40.5,   145.2,  888000000, 3885.00, 2975.00,  2100000),
  ('SUNPHARMA',  'Sun Pharmaceutical Industries','PHARMA',      'NSE', 58.2,   302.4, 2400000000, 1960.00, 1310.00,  3400000),
  ('NESTLEIND',  'Nestle India Ltd',             'FMCG',        'NSE', 278.0,  450.8,   96400000,26500.00,20075.00,   180000),
  ('ADANIPORTS', 'Adani Ports and SEZ Ltd',      'INFRASTRUCTURE','NSE',56.4,  310.2, 2160000000, 1620.00,  937.95,  5200000),
  ('KOTAKBANK',  'Kotak Mahindra Bank Ltd',      'BANKING',     'NSE', 68.5,   480.3, 1994000000, 1953.00, 1543.85,  4800000),
  ('LT',         'Larsen & Toubro Ltd',          'INFRASTRUCTURE','NSE',98.2,  632.5,  1405000000,3963.90, 2784.00,  3100000),
  ('ASIANPAINT', 'Asian Paints Ltd',             'CONSUMER',    'NSE', 52.1,   240.6,  957700000, 3394.00, 2025.00,  1200000)
ON CONFLICT (ticker) DO NOTHING;
