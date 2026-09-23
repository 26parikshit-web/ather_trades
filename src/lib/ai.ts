// ═══════════════════════════════════════════════════════════════
//  AETHER — Free AI Layer
//  Primary:  Google Gemini (gemini-1.5-flash) — free tier
//  Embeddings: HuggingFace Inference API (all-MiniLM-L6-v2) — free
//  No OpenAI. No paid APIs.
// ═══════════════════════════════════════════════════════════════
import axios from 'axios';
import { log } from './logger';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const HF_EMBEDDING_MODEL =
  process.env.HF_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
// New Inference Providers router endpoint (api-inference.huggingface.co is retired)
const HF_BASE = 'https://router.huggingface.co/hf-inference';

export const EMBEDDING_DIMS = 384; // all-MiniLM-L6-v2 output size

if (!GEMINI_API_KEY) {
  log.warn('GEMINI_API_KEY missing — AI engines will fail until configured');
}

// ─── Simple rate limiter: Gemini free tier ≈ 15 req/min ─────
const MIN_INTERVAL_MS = 4_500; // ~13 requests/minute, safely under quota
let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

// ═══════════════════════════════════════════════════════════════
//  GEMINI — Text / JSON generation
// ═══════════════════════════════════════════════════════════════
interface GeminiOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean; // force JSON output
}

// Gemini 3.x counts hidden "thinking" tokens against maxOutputTokens,
// so request a floor of 1024 output tokens to leave room for the answer.
const MIN_OUTPUT_TOKENS = 1024;

export async function geminiGenerate(
  systemPrompt: string,
  userPrompt: string,
  opts: GeminiOptions = {}
): Promise<string> {
  const { temperature = 0.3, maxTokens = 800, json = false } = opts;

  await throttle();

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: Math.max(maxTokens, MIN_OUTPUT_TOKENS),
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const response = await axios.post(
    `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent`,
    body,
    {
      params: { key: GEMINI_API_KEY },
      headers: { 'Content-Type': 'application/json' },
      timeout: 30_000,
    }
  );

  const parts: Array<{ text?: string }> =
    response.data?.candidates?.[0]?.content?.parts ?? [];
  // Gemini 3.x appends thoughtSignature parts — concatenate only text parts
  return parts
    .map((p) => p.text || '')
    .join('')
    .trim();
}

// ─── JSON helper: generate + parse, tolerating markdown fences ─
export async function geminiJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  opts: Omit<GeminiOptions, 'json'> = {}
): Promise<T> {
  const raw = await geminiGenerate(systemPrompt, userPrompt, { ...opts, json: true });
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

// ═══════════════════════════════════════════════════════════════
//  HUGGINGFACE — Embeddings for pgvector similarity search
// ═══════════════════════════════════════════════════════════════
export async function hfEmbedding(text: string): Promise<number[] | null> {
  if (!HF_API_KEY) {
    log.warn('HUGGINGFACE_API_KEY missing — embedding skipped');
    return null;
  }

  try {
    const response = await axios.post(
      `${HF_BASE}/models/${HF_EMBEDDING_MODEL}/pipeline/feature-extraction`,
      { inputs: text.slice(0, 2000) },
      {
        headers: { Authorization: `Bearer ${HF_API_KEY}` },
        timeout: 20_000,
      }
    );

    const data = response.data;
    // Model returns [384] for a single string; some models nest it
    if (Array.isArray(data) && typeof data[0] === 'number') return data as number[];
    if (Array.isArray(data) && Array.isArray(data[0])) return data[0] as number[];
    return null;
  } catch (err) {
    log.error('HuggingFace embedding failed', { err: String(err) });
    return null;
  }
}
