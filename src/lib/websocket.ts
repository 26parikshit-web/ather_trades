// ═══════════════════════════════════════════════════════════════
//  AETHER — WebSocket Server (Real-time HUD feed)
//  Endpoint: /ws?token=JWT   |   Tier-gated channel subscriptions
// ═══════════════════════════════════════════════════════════════
import type { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { URL } from 'url';
import { log } from './logger';
import {
  TIER_RANK,
  type SubscriptionTier,
  type WsChannel,
  type WsMessage,
  type WsMessageType,
} from '../types';

const WS_PROTOCOL_VERSION = '1.0';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const HEARTBEAT_INTERVAL = 30_000;

interface Client {
  ws: WebSocket;
  userId: string | null;
  tier: SubscriptionTier;
  channels: Set<WsChannel>;
  alive: boolean;
}

// ─── Channel → minimum tier required ─────────────────────────
function channelMinTier(channel: WsChannel): SubscriptionTier {
  if (channel.startsWith('quote:')) return 'BASIC';
  switch (channel) {
    case 'news':
      return 'BASIC';
    case 'oracle':
      return 'PRO';
    case 'whale_alerts':
      return 'ELITE';
    default:
      return 'BASIC';
  }
}

function hasTier(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}

class WsServer {
  private wss: WebSocketServer | null = null;
  private clients = new Set<Client>();
  private heartbeat: NodeJS.Timeout | null = null;

  init(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));

    this.heartbeat = setInterval(() => {
      for (const client of this.clients) {
        if (!client.alive) {
          client.ws.terminate();
          this.clients.delete(client);
          continue;
        }
        client.alive = false;
        client.ws.ping();
      }
    }, HEARTBEAT_INTERVAL);

    log.info('WebSocket server listening on /ws');
  }

  private onConnection(ws: WebSocket, req: import('http').IncomingMessage): void {
    let userId: string | null = null;
    let tier: SubscriptionTier = 'BASIC';

    // Authenticate via ?token=JWT (optional — anonymous gets BASIC read)
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as {
          sub?: string;
          userId?: string;
          tier?: SubscriptionTier;
        };
        userId = decoded.sub || decoded.userId || null;
        tier = (decoded.tier as SubscriptionTier) || 'BASIC';
      }
    } catch (err) {
      this.send(ws, 'ERROR', { message: 'Invalid or expired token' });
      log.warn('WS auth failed', { err: String(err) });
    }

    const client: Client = { ws, userId, tier, channels: new Set(), alive: true };
    this.clients.add(client);

    ws.on('pong', () => {
      client.alive = true;
    });

    ws.on('message', (raw) => this.onMessage(client, raw.toString()));

    ws.on('close', () => {
      this.clients.delete(client);
    });

    ws.on('error', (err) => {
      log.warn('WS client error', { err: String(err) });
      this.clients.delete(client);
    });

    this.send(ws, 'SUBSCRIBED', { channels: [], tier, message: 'Connected to AETHER feed' });
  }

  private onMessage(client: Client, raw: string): void {
    let msg: { type?: string; channels?: string[] };
    try {
      msg = JSON.parse(raw);
    } catch {
      this.send(client.ws, 'ERROR', { message: 'Malformed JSON' });
      return;
    }

    switch (msg.type) {
      case 'SUBSCRIBE': {
        const granted: string[] = [];
        const denied: string[] = [];
        for (const ch of msg.channels || []) {
          const channel = ch as WsChannel;
          if (hasTier(client.tier, channelMinTier(channel))) {
            client.channels.add(channel);
            granted.push(channel);
          } else {
            denied.push(channel);
          }
        }
        this.send(client.ws, 'SUBSCRIBED', { channels: granted, denied, tier: client.tier });
        break;
      }
      case 'UNSUBSCRIBE': {
        for (const ch of msg.channels || []) client.channels.delete(ch as WsChannel);
        this.send(client.ws, 'SUBSCRIBED', { channels: [...client.channels] });
        break;
      }
      case 'PING': {
        this.send(client.ws, 'PONG', {});
        break;
      }
      default:
        this.send(client.ws, 'ERROR', { message: `Unknown message type: ${msg.type}` });
    }
  }

  private send(ws: WebSocket, type: WsMessageType, payload: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    const message: WsMessage = {
      type,
      payload,
      timestamp: Date.now(),
      version: WS_PROTOCOL_VERSION,
    };
    ws.send(JSON.stringify(message));
  }

  // Send to every client subscribed to a given channel
  private emitToChannel(channel: WsChannel, type: WsMessageType, payload: unknown): void {
    for (const client of this.clients) {
      if (client.channels.has(channel)) {
        this.send(client.ws, type, payload);
      }
    }
  }

  // ─── Public broadcast API (used by engines) ────────────────
  broadcastQuote(ticker: string, data: unknown): void {
    this.emitToChannel(`quote:${ticker}`, 'QUOTE_UPDATE', { ticker, ...normalizeQuote(data) });
  }

  broadcastSignal(signal: unknown): void {
    this.emitToChannel('oracle', 'ORACLE_SIGNAL', signal);
  }

  broadcastNews(news: unknown): void {
    this.emitToChannel('news', 'NEWS_IMPACT', news);
  }

  broadcastWhaleAlert(alert: unknown): void {
    this.emitToChannel('whale_alerts', 'WHALE_ALERT', alert);
  }

  getStats(): { connected_clients: number; channels: number } {
    let channels = 0;
    for (const c of this.clients) channels += c.channels.size;
    return { connected_clients: this.clients.size, channels };
  }

  shutdown(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const client of this.clients) client.ws.close();
    this.clients.clear();
    this.wss?.close();
  }
}

// Quotes arrive as either LiveQuote or StockFundamentals — normalize the
// fields the HUD cares about so subscribers get a consistent shape.
function normalizeQuote(data: unknown): Record<string, unknown> {
  const d = data as Record<string, unknown>;
  if (d && typeof d === 'object' && 'ltp' in d) return d;
  if (d && typeof d === 'object' && 'live_price' in d) {
    return { ltp: d.live_price, pe: d.pe_ratio, pb: d.pb_ratio, regime: d.market_regime };
  }
  return d ?? {};
}

export const wsServer = new WsServer();
