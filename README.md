# ⚡ AETHER Backend — Tactical Market Intelligence

> **Micro-Engine Architecture** | Node.js + TypeScript + Python + Supabase + Redis
> **100% free-tier stack** — Gemini + HuggingFace instead of OpenAI, no paid video APIs

---

## 💸 Free Tier Stack (verified working)

| Capability | Provider | Cost |
|---|---|---|
| AI reasoning (signals, news sentiment, captions) | **Google Gemini** (`gemini-3.6-flash` + auto-fallback chain) | Free |
| AI embeddings (pgvector similarity) | **HuggingFace** Inference Providers (`all-MiniLM-L6-v2`, 384-dim) | Free |
| Database + Auth + RLS + pgvector | **Supabase** free tier | Free |
| Live market data | **NSE official → RapidAPI (optional) → Yahoo Finance** | Free |
| Cache | **Redis** (local Docker) — optional, degrades gracefully | Free |
| Technical indicators / regime / portfolio math | Local **Python FastAPI** | Free |
| Social posting (Reels/YouTube) | ⛔ **Disabled** (Shotstack paid API removed — captions still generated) | — |

---

## ✅ Verified End-to-End (live smoke test)

Every route tested against the live Supabase project, real NSE/Yahoo data, and real Gemini calls:

```
PASS | signup                          PASS | news analyze (real Gemini)
PASS | login                           PASS | portfolio AI review
PASS | me (profile)                   PASS | admin stats (ELITE)
PASS | index (Nifty 23446.8)           PASS | portfolio add
PASS | quote RELIANCE (₹1248, +0.61%)  PASS | portfolio list
PASS | fundamentals (PE 12.67)         PASS | portfolio remove
PASS | news feed                       PASS | broadcast signal (free mode)
PASS | admin gate → 403                PASS | broadcast logs
PASS | oracle gate → 403               PASS | oracle signal (real Gemini: TCS WATCH 45%)
```

Run it yourself: `npx tsx scripts/smoke-test.ts` (Node API must be running)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AETHER BACKEND                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  DATA PULSE  │  │ ORACLE BRAIN │  │  CHRONOS NEWS    │  │
│  │ NSE→Yahoo    │  │ GEMINI AI    │  │  RSS + GEMINI    │  │
│  │  Live Quotes │  │  Signals     │  │  Sentiment       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬──────────┘  │
│         │                 │                   │             │
│         └─────────────────┼───────────────────┘             │
│                           │                                 │
│                    ┌──────▼───────┐                         │
│                    │  WebSocket   │  ← Real-time HUD Feed   │
│                    │  Server /ws  │                         │
│                    └──────┬───────┘                         │
│                           │                                 │
│  ┌──────────────┐  ┌──────▼───────┐  ┌──────────────────┐  │
│  │ PULSE STUDIO │  │  Express API │  │  Python AI       │  │
│  │ captions only│  │  REST Routes │  │  ML Indicators   │  │
│  │ (free mode)  │  │  + Auth/JWT  │  │  FastAPI :8000   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌──────────────────┐     ┌───────────────────────────────┐ │
│  │  Supabase        │     │  Redis Cache                  │ │
│  │  PostgreSQL+RLS  │     │  TTL: 3s quotes, 5m fundas    │ │
│  │  pgvector(384)   │     │  (optional — circuit breaker) │ │
│  └──────────────────┘     └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Install
```bash
npm install
```

### 2. Environment
```bash
cp .env.example .env   # then fill in the keys below
```

### 3. Free API Keys
| Key | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `HUGGINGFACE_API_KEY` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) (needs "Inference Providers" permission) |
| `SUPABASE_URL` / `SUPABASE_KEY` / `SUPABASE_SERVICE_KEY` | Supabase → Settings → API (**use the legacy `anon` + `service_role` JWT keys**) |

### 4. Database (Supabase CLI — recommended)
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push        # applies supabase/migrations/*.sql
```
Or paste `supabase/schema.sql` into the Supabase SQL Editor.

> **Post-setup:** disable email confirmation for dev — Dashboard → Authentication → Sign In / Providers → Email → turn **off** "Confirm email" (or the API auto-confirms on signup via the admin client).

### 5. Run
```bash
# Terminal 1 — Node API
npm run dev

# Terminal 2 — Python AI
cd python-ai && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Optional — Redis cache
docker run -d -p 6379:6379 redis:7-alpine
```

### 6. Verify
```bash
npx tsx scripts/smoke-test.ts
```

### 7. Docker (production)
```bash
docker-compose up --build
```

```
┌─────────────────────────────────────────────────────────────┐
│                     AETHER BACKEND                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  DATA PULSE  │  │ ORACLE BRAIN │  │  CHRONOS NEWS    │  │
│  │  NSE/BSE     │  │  GPT-4 AI    │  │  RSS + OpenAI    │  │
│  │  Live Quotes │  │  Signals     │  │  Sentiment       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬──────────┘  │
│         │                 │                   │             │
│         └─────────────────┼───────────────────┘             │
│                           │                                 │
│                    ┌──────▼───────┐                         │
│                    │  WebSocket   │  ← Real-time HUD Feed   │
│                    │  Server /ws  │                         │
│                    └──────┬───────┘                         │
│                           │                                 │
│  ┌──────────────┐  ┌──────▼───────┐  ┌──────────────────┐  │
│  │ PULSE STUDIO │  │  Express API │  │  Python AI       │  │
│  │ IG + YouTube │  │  REST Routes │  │  ML Indicators   │  │
│  │  Auto-post   │  │  + Auth/JWT  │  │  FastAPI :8000   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌──────────────────┐     ┌───────────────────────────────┐ │
│  │  Supabase        │     │  Redis Cache                  │ │
│  │  PostgreSQL+RLS  │     │  TTL: 3s quotes, 5m fundas    │ │
│  │  pgvector        │     │                               │ │
│  └──────────────────┘     └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Optional / Paid Integrations (all removed in free mode)

These are **not required** and are disabled by default:

| Integration | Status | Notes |
|---|---|---|
| OpenAI (GPT-4) | ❌ Removed | Replaced by Gemini (free) |
| Shotstack (video rendering) | ❌ Removed | Paid. Pulse Studio now generates text signal cards |
| Instagram Graph API | ⏸️ Stubbed | Free but needs Meta app review; `instagram_status = 'DISABLED'` |
| YouTube Data API | ⏸️ Stubbed | Free quota exists; upload code removed for now |
| RapidAPI NSE | ➕ Optional | Free tier available; app falls back to Yahoo Finance without it |

---

## 📡 API Reference

All responses use the envelope `{ "success": true, "data": ... }` or `{ "success": false, "error": "..." }`.
Auth = `Authorization: Bearer <JWT>` header.

### Auth — `/api/auth`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | — | Register (auto-confirms email, returns JWT) |
| POST | `/api/auth/login` | — | Login, returns JWT + tier |
| GET | `/api/auth/me` | ✅ | Current profile + subscription tier |

### Stocks — `/api/stocks`
| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| GET | `/index` | ALL | Nifty 50 / Bank Nifty / Sensex pulse |
| GET | `/quote/:ticker` | ALL | Live quote (NSE → RapidAPI → Yahoo) |
| GET | `/fundamentals/:ticker` | ALL | PE, PB, ROI, regime, whale score |
| POST | `/bulk` | ALL | Bulk quotes, body `{ tickers: [] }` (max 50) |
| GET | `/signal/:ticker` | PRO+ | Oracle AI signal (Gemini) |
| GET | `/hover/:ticker` | PRO+ | 2-sentence AI insight |
| GET | `/similar/:ticker?context=` | PRO+ | pgvector similarity search (HuggingFace embeddings) |

### News — `/api/news`
| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| GET | `/?limit=&category=&minImpact=` | ALL | Latest analyzed headlines |
| POST | `/analyze` | ALL | Analyze a custom headline (Gemini) |
| POST | `/scan` | ALL | Trigger RSS + NSE announcement scan |

### Portfolio — `/api/portfolio`
| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| GET | `/` | PRO+ | Holdings + live P&L summary |
| POST | `/` | PRO+ | Add/update holding (upsert) |
| DELETE | `/holding/:ticker` | PRO+ | Remove holding |
| GET | `/ai-review` | ELITE | AI rebalancing review (Gemini) |

### Broadcast (Pulse Studio — free mode) — `/api/broadcast`
| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| POST | `/signal` | ELITE | Generate caption + signal card (logged, not posted) |
| POST | `/daily-recap` | ELITE | Trigger daily recap now |
| GET | `/logs?limit=` | ELITE | Broadcast history |

### Admin — `/api/admin` (all ELITE)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | WS clients, uptime, memory, provider info |
| POST | `/scan/signals` | Batch Oracle scan, body `{ tickers: [] }` (max 20) |
| POST | `/scan/news` | Manual news scan |
| POST | `/broadcast/recap` | Trigger daily recap |
| POST | `/cache/flush` | body `{ pattern: "quote:*" }` |

---

## 🛰️ WebSocket Guide

**Connect:** `ws://localhost:3000/ws?token=YOUR_JWT`

### Subscribe to channels
```json
{
  "type": "SUBSCRIBE",
  "channels": ["quote:RELIANCE", "quote:TCS", "oracle", "news"]
}
```

### Available Channels
| Channel | Tier | Messages |
|---------|------|----------|
| `quote:TICKER` | ALL | Live price updates every 5s |
| `news` | ALL | New analyzed headlines |
| `oracle` | PRO+ | New AI signals |
| `whale_alerts` | ELITE | High-impact alerts |

### Message Format
```json
{
  "type": "QUOTE_UPDATE",
  "payload": { "ticker": "RELIANCE", "ltp": 2850.50, "change_pct": 1.2 },
  "timestamp": 1706789000000,
  "version": "1.0"
}
```

---

## ⏱️ Cron Schedule

| Engine | Job | Schedule |
|--------|-----|----------|
| Data Pulse | Index pulse (Nifty/Sensex) | Every 5 seconds |
| Data Pulse | Watchlist bulk quotes | Every 15 seconds |
| Data Pulse | Full fundamentals refresh | Every 1 minute |
| Chronos | News scan (market hours) | Every 5 minutes |
| Pulse Studio | Daily recap broadcast | 4:15 PM IST Mon–Fri |

---

## 🐍 Python AI Endpoints

Base URL: `http://localhost:8000`
All require header: `x-internal-secret: YOUR_PYTHON_AI_SECRET`

| POST | `/indicators/full` | RSI, MACD, Bollinger, Stochastic, ATR |
| POST | `/regime/detect` | Market regime with confidence |
| POST | `/portfolio/optimize` | Sharpe ratio + rebalance advice |
| POST | `/sentiment/analyze` | Fast batch sentiment |

---

## 📂 Project Structure

```
automation/                        (repo: ather_trades)
├── src/
│   ├── engines/
│   │   ├── data-pulse.ts       ← NSE → RapidAPI → Yahoo quotes + WS feed
│   │   ├── oracle-brain.ts     ← Gemini signals + HF vector search
│   │   ├── chronos-news.ts     ← RSS/NSE scraper + Gemini sentiment
│   │   └── pulse-studio.ts     ← Free mode: captions + signal cards
│   ├── routes/
│   │   ├── auth.ts             ← Signup/login (auto email-confirm) + JWT
│   │   ├── stocks.ts           ← Quotes, fundamentals, signals, hover
│   │   ├── portfolio.ts        ← Holdings + live P&L
│   │   ├── news.ts             ← News feed + analysis
│   │   ├── broadcast.ts        ← Pulse Studio API (free mode)
│   │   └── admin.ts            ← System management + manual scans
│   ├── lib/
│   │   ├── ai.ts               ← Gemini (retry + model fallback) + HF embeddings
│   │   ├── supabase.ts         ← DB client (public + admin)
│   │   ├── websocket.ts        ← WS server + tier-gated subscriptions
│   │   ├── cache.ts            ← Redis with TTL + circuit breaker
│   │   └── logger.ts           ← Winston structured logging
│   ├── middleware/auth.ts      ← JWT verify + tier gates
│   ├── types/index.ts          ← All shared TypeScript types
│   └── server.ts               ← Entry point + bootstrap
├── scripts/
│   └── smoke-test.ts           ← 18-check end-to-end verification
├── supabase/
│   ├── schema.sql              ← Full schema + seed (SQL Editor paste-in)
│   ├── migrations/             ← CLI migrations (supabase db push)
│   │   ├── 20260924000000_aether_schema.sql
│   │   └── 20260924010000_fix_handle_new_user.sql
│   └── functions/live-quote/   ← Edge function (Deno)
├── python-ai/
│   ├── main.py                 ← FastAPI indicators/regime/portfolio/sentiment
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── tsconfig.json
```

---

## 🧠 Notable Implementation Details

- **Gemini resilience** — free-tier models return 503 under load. `src/lib/ai.ts` retries with exponential backoff, then fails over through a model chain (`gemini-3.6-flash → gemini-flash-latest → gemini-flash-lite-latest → gemini-3.5-flash → gemini-3.8-flash`). A global throttle keeps usage under the free quota.
- **Gemini 3.x quirks** — "thinking" tokens count against `maxOutputTokens` (we floor requests at 1024) and responses include `thoughtSignature` parts (we concatenate text parts only).
- **Supabase keys** — the new `sb_publishable_` / `sb_secret_` keys are not accepted by `supabase-js` v2 for REST/RLS work; use the legacy `anon` + `service_role` JWT keys.
- **`handle_new_user()` trigger** — must declare `SET search_path = public`, otherwise GoTrue's role fails with "Database error saving new user".
- **NSE blocking** — `quote-equity` returns 403 from non-Indian IPs; Yahoo Finance is the free fallback. `/api/allIndices` still works directly.
- **Redis is optional** — a circuit breaker marks Redis unavailable for 60s after a failed connect so requests never wait on the 5s timeout.
- **Embeddings are 384-dim** (`all-MiniLM-L6-v2`) — schema uses `vector(384)`, not OpenAI's 1536.

