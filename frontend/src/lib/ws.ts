// ═══════════════════════════════════════════════════════════════
//  AETHER Frontend — WebSocket client
//  Streams QUOTE_UPDATE / ORACLE_SIGNAL / NEWS_IMPACT / WHALE_ALERT
//  Auto-reconnect with exponential backoff + heartbeat.
// ═══════════════════════════════════════════════════════════════
import { getToken } from './api';
import type { WsChannel, WsMessage } from '../types';

const BASE_WS_URL = import.meta.env.VITE_WS_URL ?? '';

export type WsStatus = 'connecting' | 'connected' | 'disconnected';

type Handler = (payload: unknown) => void;

class AetherSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private statusHandlers = new Set<(s: WsStatus) => void>();
  private channels = new Set<string>();
  private attempts = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnect: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  status: WsStatus = 'disconnected';

  private url(): string {
    const token = getToken();
    if (BASE_WS_URL) {
      const u = new URL(`${BASE_WS_URL}/ws`);
      if (token) u.searchParams.set('token', token);
      return u.toString();
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const q = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${proto}://${location.host}/ws${q}`;
  }

  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    )
      return;

    this.manualClose = false;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url());
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.attempts = 0;
      this.setStatus('connected');
      // Re-subscribe everything we care about
      for (const ch of this.channels) this.rawSubscribe(ch);
      this.heartbeat = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN)
          this.ws.send(JSON.stringify({ type: 'PING' }));
      }, 30_000);
    };

    this.ws.onmessage = (ev: MessageEvent<string>) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(ev.data) as WsMessage;
      } catch {
        return;
      }
      this.handlers.get(msg.type)?.forEach((h) => h(msg.payload));
    };

    this.ws.onclose = () => {
      if (this.heartbeat) clearInterval(this.heartbeat);
      this.heartbeat = null;
      if (!this.manualClose) this.scheduleReconnect();
      else this.setStatus('disconnected');
    };

    this.ws.onerror = () => {
      /* onclose handles retry */
    };
  }

  private scheduleReconnect(): void {
    this.setStatus('disconnected');
    if (this.reconnect) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.attempts++);
    this.reconnect = setTimeout(() => {
      this.reconnect = null;
      this.connect();
    }, delay);
  }

  private setStatus(s: WsStatus): void {
    this.status = s;
    this.statusHandlers.forEach((h) => h(s));
  }

  private rawSubscribe(channel: string): void {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify({ type: 'SUBSCRIBE', channels: [channel] }));
  }

  subscribe(channel: WsChannel, handler: Handler): () => void {
    this.channels.add(channel);
    if (!this.handlers.has(channel)) this.handlers.set(channel, new Set());
    this.handlers.get(channel)!.add(handler);
    this.rawSubscribe(channel);
    this.connect();

    return () => {
      this.handlers.get(channel)?.delete(handler);
      if (this.handlers.get(channel)?.size === 0) {
        this.handlers.delete(channel);
        this.channels.delete(channel);
        if (this.ws?.readyState === WebSocket.OPEN)
          this.ws.send(JSON.stringify({ type: 'UNSUBSCRIBE', channels: [channel] }));
      }
    };
  }

  on(type: string, handler: Handler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    this.connect();
    return () => this.handlers.get(type)?.delete(handler);
  }

  onStatus(handler: (s: WsStatus) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  close(): void {
    this.manualClose = true;
    if (this.reconnect) clearTimeout(this.reconnect);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.reconnect = null;
    this.heartbeat = null;
    this.ws?.close();
    this.ws = null;
  }
}

export const socket = new AetherSocket();
