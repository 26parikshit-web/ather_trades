# ⚡ AETHER Backend — Tactical Market Intelligence

> **Micro-Engine Architecture** | Node.js + TypeScript + Python + Supabase + Redis

---

## 🏗️ Architecture Overview

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

## 🚀 Quick Start

### 1. Clone & Install
```bash
cd aether-backend
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Fill in your keys — see KEY SETUP below
```

### 3. Database Setup
- Go to your Supabase project → SQL Editor
- Paste and run the entire contents of `supabase/schema.sql`

### 4. Run (Development)
```bash
# Terminal 1: Node.js API
npm run dev

# Terminal 2: Python AI Service
cd python-ai
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 5. Run (Docker — Production)
```bash
docker-compose up --build
```

---

## 🔑 Key Setup Guide

### Supabase
1. Create project at [supabase.com](https://supabase.com)
2. Copy `SUPABASE_URL` and `SUPABASE_KEY` (anon) from Settings → API
3. Copy `SUPABASE_SERVICE_KEY` (service_role) — keep secret!

### OpenAI
1. Get key at [platform.openai.com](https://platform.openai.com)
2. Set `OPENAI_API_KEY=sk-...`
3. Default model: `gpt-4-turbo`

### NSE Market Data (RapidAPI)
1. Sign up at [rapidapi.com](https://rapidapi.com)
2. Subscribe to **"Latest Stock Price"** API (free tier available)
3. Set `NSE_RAPIDAPI_KEY` and `NSE_RAPIDAPI_HOST`

### Instagram (Meta Graph API)
1. Create Meta Developer App at [developers.facebook.com](https://developers.facebook.com)
2. Add Instagram Basic Display API
3. Get long-lived access token and IG User ID
4. Set `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_USER_ID`

### Shotstack (Video Rendering)
1. Sign up at [shotstack.io](https://shotstack.io)
2. Set `SHOTSTACK_API_KEY` and `SHOTSTACK_ENV=stage` (test) or `production`

### YouTube Data API
1. Create project in Google Cloud Console
2. Enable YouTube Data API v3
3. Set `YOUTUBE_API_KEY`

---

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register + get JWT |
| POST | `/api/auth/login` | Login + get JWT |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |

### Stocks (All require JWT)
| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| GET | `/api/stocks/index` | ALL | Nifty, Sensex, BankNifty |
| GET | `/api/stocks/:ticker/quote` | ALL | Live price quote |
| GET | `/api/stocks/:ticker/fundamentals` | ALL | PE, PB, regime |
| GET | `/api/stocks/:ticker/signal` | PRO+ | Oracle AI signal |
| GET | `/api/stocks/:ticker/hover` | PRO+ | 2-sentence AI insight |
| GET | `/api/stocks/:ticker/similar` | ELITE | Vector similarity |
| GET | `/api/stocks/signals/latest` | PRO+ | All recent signals |
| GET | `/api/stocks/screener` | ELITE | Filter by PE/PB/whale |
| POST | `/api/stocks/bulk-quotes` | ALL | Up to 50 tickers |

### News
| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| GET | `/api/news/feed` | ALL | Latest analyzed news |
| POST | `/api/news/analyze` | PRO+ | Analyze custom headline |
| POST | `/api/news/scan` | ELITE | Trigger full news scan |

### Portfolio
| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| GET | `/api/portfolio` | ALL | Get holdings + P&L |
| POST | `/api/portfolio/holding` | PRO+ | Add holding |
| DELETE | `/api/portfolio/holding/:ticker` | PRO+ | Remove holding |
| GET | `/api/portfolio/ai-review` | ELITE | AI portfolio review |

### Broadcast (Pulse Studio)
| Method | Endpoint | Tier | Description |
|--------|----------|------|-------------|
| POST | `/api/broadcast/signal` | ELITE | Post signal to IG + YT |
| POST | `/api/broadcast/daily-recap` | ELITE | Trigger daily recap |
| GET | `/api/broadcast/logs` | ELITE | Broadcast history |

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
aether-backend/
├── src/
│   ├── engines/
│   │   ├── data-pulse.ts       ← Live NSE/BSE data + WebSocket feed
│   │   ├── oracle-brain.ts     ← GPT-4 signals + vector search
│   │   ├── chronos-news.ts     ← News scraper + AI sentiment
│   │   └── pulse-studio.ts     ← Instagram + YouTube automation
│   ├── routes/
│   │   ├── auth.ts             ← JWT auth endpoints
│   │   ├── stocks.ts           ← Market data + signals
│   │   ├── portfolio.ts        ← Holdings + P&L
│   │   ├── news.ts             ← News feed + analysis
│   │   ├── broadcast.ts        ← Pulse Studio API
│   │   └── admin.ts            ← System management
│   ├── lib/
│   │   ├── supabase.ts         ← DB client (public + admin)
│   │   ├── websocket.ts        ← WS server + subscriptions
│   │   ├── cache.ts            ← Redis with TTL constants
│   │   └── logger.ts           ← Winston structured logging
│   ├── middleware/
│   │   └── auth.ts             ← JWT verify + tier gates
│   ├── types/
│   │   └── index.ts            ← All shared TypeScript types
│   └── server.ts               ← Entry point + bootstrap
├── supabase/
│   ├── schema.sql              ← Full DB schema + seed data
│   └── functions/
│       └── live-quote/         ← Edge function (ultra-low latency)
├── python-ai/
│   ├── main.py                 ← FastAPI ML service
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── tsconfig.json
```
