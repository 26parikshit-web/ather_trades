"""
═══════════════════════════════════════════════════════════════
AETHER — Python AI Microservice (FastAPI)
Heavy ML: Sentiment transformers, technical indicators,
          portfolio optimization, regime detection
Run: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
═══════════════════════════════════════════════════════════════
"""
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os, math, statistics
from datetime import datetime

app = FastAPI(title="AETHER Python AI Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PYTHON_AI_SECRET = os.getenv("PYTHON_AI_SECRET", "shared-secret")

def verify_secret(x_internal_secret: str = Header(default=None)):
    if x_internal_secret != PYTHON_AI_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

# ─── Models ──────────────────────────────────────────────────
class PriceSeriesInput(BaseModel):
    ticker: str
    closes: List[float]
    highs: Optional[List[float]] = None
    lows: Optional[List[float]] = None
    volumes: Optional[List[int]] = None

class SentimentInput(BaseModel):
    texts: List[str]

class PortfolioInput(BaseModel):
    holdings: List[dict]  # [{ticker, weight, returns: [float]}]

class RegimeInput(BaseModel):
    ticker: str
    closes: List[float]
    volumes: List[int]
    period: int = 20

# ─── Technical Indicators ────────────────────────────────────
@app.post("/indicators/full")
def compute_full_indicators(data: PriceSeriesInput, _=Depends(verify_secret)):
    closes = data.closes
    if len(closes) < 26:
        raise HTTPException(status_code=400, detail="Need at least 26 data points")

    def ema(prices, period):
        k = 2 / (period + 1)
        ema_vals = [prices[0]]
        for p in prices[1:]:
            ema_vals.append(p * k + ema_vals[-1] * (1 - k))
        return ema_vals

    # RSI
    gains, losses = [], []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = sum(gains[-14:]) / 14
    avg_loss = sum(losses[-14:]) / 14
    rsi = 100 - (100 / (1 + avg_gain / avg_loss)) if avg_loss != 0 else 100

    # MACD
    ema12 = ema(closes, 12)
    ema26 = ema(closes, 26)
    macd_line = [e12 - e26 for e12, e26 in zip(ema12, ema26)]
    signal_line = ema(macd_line, 9)
    macd_hist = macd_line[-1] - signal_line[-1]
    macd_crossover = "BULLISH" if macd_hist > 0 else "BEARISH"

    # Bollinger Bands (20-period)
    period = 20
    sma20 = sum(closes[-period:]) / period
    std20 = statistics.stdev(closes[-period:])
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20
    bb_width = (bb_upper - bb_lower) / sma20

    # Stochastic %K
    high14 = max(data.highs[-14:]) if data.highs else closes[-1]
    low14  = min(data.lows[-14:])  if data.lows  else closes[-1]
    stoch_k = ((closes[-1] - low14) / (high14 - low14)) * 100 if high14 != low14 else 50

    # ATR
    atr = 0
    if data.highs and data.lows and len(data.highs) >= 14:
        true_ranges = [data.highs[i] - data.lows[i] for i in range(-14, 0)]
        atr = sum(true_ranges) / 14

    # Volume analysis
    vol_surge = False
    avg_vol = 0
    if data.volumes and len(data.volumes) >= 5:
        avg_vol = sum(data.volumes[-30:]) / len(data.volumes[-30:]) if len(data.volumes) >= 30 else sum(data.volumes) / len(data.volumes)
        vol_surge = data.volumes[-1] > avg_vol * 2.0

    return {
        "ticker": data.ticker,
        "rsi": round(rsi, 2),
        "rsi_signal": "OVERBOUGHT" if rsi > 70 else "OVERSOLD" if rsi < 30 else "NEUTRAL",
        "macd": round(macd_line[-1], 4),
        "macd_signal": round(signal_line[-1], 4),
        "macd_histogram": round(macd_hist, 4),
        "macd_crossover": macd_crossover,
        "bb_upper": round(bb_upper, 2),
        "bb_middle": round(sma20, 2),
        "bb_lower": round(bb_lower, 2),
        "bb_width": round(bb_width, 4),
        "bb_position": round((closes[-1] - bb_lower) / (bb_upper - bb_lower), 3),
        "stochastic_k": round(stoch_k, 2),
        "stoch_signal": "OVERBOUGHT" if stoch_k > 80 else "OVERSOLD" if stoch_k < 20 else "NEUTRAL",
        "atr": round(atr, 2),
        "atr_pct": round((atr / closes[-1]) * 100, 3),
        "volume_surge": vol_surge,
        "avg_volume": int(avg_vol),
        "computed_at": datetime.utcnow().isoformat()
    }

# ─── Market Regime (Advanced ML-style) ───────────────────────
@app.post("/regime/detect")
def detect_regime(data: RegimeInput, _=Depends(verify_secret)):
    closes = data.closes
    volumes = data.volumes
    period = data.period

    if len(closes) < period:
        return {"regime": "RANGING", "confidence": 0}

    sma = sum(closes[-period:]) / period
    std = statistics.stdev(closes[-period:])
    current = closes[-1]

    # Directional movement
    slope = (closes[-1] - closes[-period]) / closes[-period] * 100
    vol_pct = (std / sma) * 100

    # Volume trend
    avg_vol_recent = sum(volumes[-5:]) / 5
    avg_vol_base = sum(volumes[-period:]) / period
    vol_ratio = avg_vol_recent / avg_vol_base if avg_vol_base > 0 else 1

    # Regime classification
    if vol_ratio > 2.0 and abs(slope) > 3:
        regime = "BREAKOUT"
        confidence = min(95, int(vol_ratio * 20 + abs(slope) * 5))
    elif vol_pct > 3.5:
        regime = "VOLATILE"
        confidence = min(90, int(vol_pct * 15))
    elif slope > 2 and current > sma:
        regime = "TRENDING_UP"
        confidence = min(88, int(slope * 8 + (current - sma) / std * 10))
    elif slope < -2 and current < sma:
        regime = "TRENDING_DOWN"
        confidence = min(88, int(abs(slope) * 8 + (sma - current) / std * 10))
    else:
        regime = "RANGING"
        confidence = min(80, int(100 - vol_pct * 10))

    return {
        "ticker": data.ticker,
        "regime": regime,
        "confidence": max(0, min(100, confidence)),
        "slope_pct": round(slope, 3),
        "volatility_pct": round(vol_pct, 3),
        "volume_ratio": round(vol_ratio, 3),
        "sma": round(sma, 2),
        "std_dev": round(std, 2)
    }

# ─── Portfolio Optimizer (Equal Risk Contribution) ───────────
@app.post("/portfolio/optimize")
def optimize_portfolio(data: PortfolioInput, _=Depends(verify_secret)):
    holdings = data.holdings

    if not holdings:
        raise HTTPException(status_code=400, detail="No holdings provided")

    results = []
    total_inv = sum(h.get("invested", 1) for h in holdings)

    for h in holdings:
        returns = h.get("returns", [0])
        avg_ret = sum(returns) / len(returns) if returns else 0
        std_ret = statistics.stdev(returns) if len(returns) > 1 else 0
        sharpe  = avg_ret / std_ret if std_ret > 0 else 0
        weight  = h.get("invested", 0) / total_inv if total_inv > 0 else 0

        results.append({
            "ticker":        h.get("ticker"),
            "current_weight": round(weight * 100, 2),
            "avg_return":    round(avg_ret, 4),
            "volatility":    round(std_ret, 4),
            "sharpe_ratio":  round(sharpe, 3),
            "recommendation": (
                "REDUCE"   if weight > 0.25 else
                "INCREASE" if sharpe > 1.5 and weight < 0.05 else
                "HOLD"
            )
        })

    return {
        "optimized_holdings": results,
        "total_holdings": len(results),
        "computed_at": datetime.utcnow().isoformat()
    }

# ─── Simple Sentiment (keyword-based) ────────────────────────
@app.post("/sentiment/analyze")
def analyze_sentiment(data: SentimentInput, _=Depends(verify_secret)):
    """
    Fast keyword-based sentiment. Use OpenAI (Chronos) for deep analysis.
    This is a high-throughput fallback for batch processing.
    """
    BULLISH_WORDS = {
        "surge", "rally", "gain", "profit", "beat", "record", "high",
        "growth", "positive", "strong", "upgrade", "buy", "bullish",
        "outperform", "expansion", "boost", "rise", "up", "exceed"
    }
    BEARISH_WORDS = {
        "fall", "drop", "loss", "miss", "decline", "cut", "downgrade",
        "sell", "bearish", "underperform", "weak", "low", "crash",
        "default", "fraud", "sebi", "ban", "penalty", "warning"
    }

    results = []
    for text in data.texts:
        words = set(text.lower().split())
        bull_hits = len(words & BULLISH_WORDS)
        bear_hits = len(words & BEARISH_WORDS)
        total = bull_hits + bear_hits

        if total == 0:
            score = 0.0
        else:
            score = round((bull_hits - bear_hits) / total, 3)

        results.append({
            "text": text[:100],
            "sentiment_score": score,
            "label": "POSITIVE" if score > 0.1 else "NEGATIVE" if score < -0.1 else "NEUTRAL",
            "bullish_signals": bull_hits,
            "bearish_signals": bear_hits
        })

    return {"results": results, "count": len(results)}

# ─── Health ───────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "OK",
        "service": "AETHER Python AI Engine",
        "timestamp": datetime.utcnow().isoformat()
    }
