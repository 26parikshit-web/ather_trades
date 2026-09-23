// ═══════════════════════════════════════════════════════════════
//  AETHER — Server Entry Point
//  Micro-Engine Architecture | Node.js + TypeScript
// ═══════════════════════════════════════════════════════════════
import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { log } from './lib/logger';
import { wsServer } from './lib/websocket';
import { getRedis } from './lib/cache';

// ── Routes ────────────────────────────────────────────────────
import authRoutes from './routes/auth';
import stockRoutes from './routes/stocks';
import portfolioRoutes from './routes/portfolio';
import newsRoutes from './routes/news';
import broadcastRoutes from './routes/broadcast';
import adminRoutes from './routes/admin';

// ── Engine Schedulers ─────────────────────────────────────────
import { startDataPulseScheduler } from './engines/data-pulse';
import { startChronosScheduler } from './engines/chronos-news';
import { startPulseStudioScheduler } from './engines/pulse-studio';

const app = express();
const server = http.createServer(app);

// ═══════════════════════════════════════════════════════════════
//  MIDDLEWARE STACK
// ═══════════════════════════════════════════════════════════════
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    /\.aether\.io$/,
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, slow down.' },
}));

// Request logger
app.use((req, _res, next) => {
  log.debug(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ═══════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/admin', adminRoutes);

// Health check (public)
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'AETHER Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ws_clients: wsServer.getStats().connected_clients,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('Unhandled error', { err: err.message, stack: err.stack });
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ═══════════════════════════════════════════════════════════════
//  STARTUP SEQUENCE
// ═══════════════════════════════════════════════════════════════
async function bootstrap(): Promise<void> {
  const PORT = parseInt(process.env.PORT || '3000');

  try {
    // 1. Connect Redis (optional — cache degrades gracefully if down)
    try {
      await getRedis();
      log.info('✅ Redis connected');
    } catch (err) {
      log.warn('⚠️ Redis unavailable — running without cache (free/dev mode)', {
        hint: 'Start Redis via: docker run -d -p 6379:6379 redis:7-alpine',
      });
    }

    // 2. Initialize WebSocket server
    wsServer.init(server);
    log.info('✅ WebSocket server initialized on /ws');

    // 3. Start all engine schedulers
    startDataPulseScheduler();
    log.info('✅ Data Pulse engine started');

    startChronosScheduler();
    log.info('✅ Chronos News engine started');

    startPulseStudioScheduler();
    log.info('✅ Pulse Studio engine started');

    // 4. Start HTTP server
    server.listen(PORT, () => {
      log.info(`\n⚡ AETHER Backend online — http://localhost:${PORT}`);
      log.info(`🛰️  WebSocket endpoint — ws://localhost:${PORT}/ws`);
      log.info(`🩺 Health check — http://localhost:${PORT}/health\n`);
    });

  } catch (err) {
    log.error('Bootstrap failed', { err });
    process.exit(1);
  }
}

// ─── Graceful shutdown ────────────────────────────────────────
process.on('SIGTERM', () => {
  log.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', { err: err.message });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection', { reason });
});

bootstrap();
