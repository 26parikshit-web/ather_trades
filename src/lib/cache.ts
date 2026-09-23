// ═══════════════════════════════════════════════════════════════
//  AETHER — Redis Cache Layer
//  TTL policy: 3s live quotes, 5m fundamentals, etc.
// ═══════════════════════════════════════════════════════════════
import { createClient, type RedisClientType } from 'redis';
import { log } from './logger';

// ─── TTL constants (seconds) ─────────────────────────────────
export const TTL = {
  LIVE_QUOTE: 3,        // Ultra-fresh quotes
  FUNDAMENTALS: 300,    // 5 minutes
  ORACLE_SIGNAL: 900,   // 15 minutes
  NEWS: 300,            // 5 minutes
  INDEX_PULSE: 3,
  HOVER: 300,
} as const;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

// ─── Circuit breaker ─────────────────────────────────────────
// If Redis is unreachable we stop retrying for a cooldown window so
// cache calls return instantly instead of waiting on a 5s timeout.
const COOLDOWN_MS = 60_000;
let redisDownUntil = 0;

function isRedisDown(): boolean {
  return Date.now() < redisDownUntil;
}

// ─── Singleton connection ────────────────────────────────────
// Fails fast (5s) so boot never hangs when Redis is down —
// the cache wrapper degrades gracefully to miss/no-op.
const CONNECT_TIMEOUT_MS = 5_000;

export async function getRedis(): Promise<RedisClientType> {
  if (client?.isReady) return client;
  if (isRedisDown()) throw new Error('Redis marked unavailable (cooldown)');
  if (connecting) return connecting;

  connecting = (async () => {
    const c = createClient({ url: REDIS_URL }) as RedisClientType;
    c.on('error', (err) => log.error('Redis client error', { err: String(err) }));
    c.on('reconnecting', () => log.warn('Redis reconnecting...'));
    try {
      await Promise.race([
        c.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis connect timeout')), CONNECT_TIMEOUT_MS)
        ),
      ]);
    } catch (err) {
      redisDownUntil = Date.now() + COOLDOWN_MS;
      try {
        await c.disconnect();
      } catch {
        /* ignore */
      }
      throw err;
    }
    client = c;
    return c;
  })();

  try {
    return await connecting;
  } finally {
    connecting = null;
  }
}

// ─── Cache wrapper with graceful degradation ─────────────────
// If Redis is down, reads miss and writes no-op so the API stays up.
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = await getRedis();
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      log.warn(`Cache get failed for ${key}`, { err: String(err) });
      return null;
    }
  },

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (err) {
      log.warn(`Cache set failed for ${key}`, { err: String(err) });
    }
  },

  async del(key: string): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.del(key);
    } catch (err) {
      log.warn(`Cache del failed for ${key}`, { err: String(err) });
    }
  },

  async flushPattern(pattern: string): Promise<void> {
    try {
      const redis = await getRedis();
      for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        await redis.del(key);
      }
    } catch (err) {
      log.warn(`Cache flush failed for ${pattern}`, { err: String(err) });
    }
  },
};
