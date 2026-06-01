import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { TickerData } from './types';

// SafeTrade dùng safe.trade cho WebSocket infrastructure
// URL format: wss://safe.trade/api/v2/websocket/{type}
const SAFETRADE_WS_BASE_URL = 'https://safe.trade/api/v2';
const SAFETRADE_WS_URL = 'wss://safe.trade/api/v2/websocket/public';

export interface TickerUpdateEvent {
  market: string;
  ticker: TickerData;
}

/**
 * SafeTradeWebSocket - Kết nối WebSocket realtime với SafeTrade
 * Subscribe vào channel global.tickers để nhận cập nhật giá realtime
 */
export class SafeTradeWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isConnected = false;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 3;  // Giới hạn reconnect để tránh spam
  private readonly RECONNECT_DELAY_MS = 10000; // 10s giữa các lần thử
  private readonly PING_INTERVAL_MS = 30000;

  constructor(private readonly wsUrl: string = SAFETRADE_WS_URL) {
    // Suppress unused variable warning
    void SAFETRADE_WS_BASE_URL;
    super();
  }

  connect(): void {
    if (this.isConnected) return;

    console.log(`[WS] Đang kết nối tới SafeTrade WebSocket: ${this.wsUrl}`);

    this.ws = new WebSocket(this.wsUrl, {
      headers: {
        'Origin': 'https://safe.trade',
        'User-Agent': 'SafeTradeBot/1.0',
      },
    });

    this.ws.on('open', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[WS] ✅ Kết nối WebSocket thành công!');
      this.emit('connected');

      // Subscribe vào global tickers channel
      this.subscribeToGlobalTickers();

      // Bắt đầu ping để giữ kết nối
      this.startPing();
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const raw = data.toString();
        const message = JSON.parse(raw);
        this.handleMessage(message);
      } catch {
        // Bỏ qua tin nhắn không parse được
      }
    });

    this.ws.on('close', (code, reason) => {
      this.isConnected = false;
      this.stopPing();
      console.log(`[WS] ❌ Kết nối đóng (code: ${code}, reason: ${reason.toString()})`);
      this.emit('disconnected');

      if (this.shouldReconnect && this.reconnectAttempts < this.MAX_RECONNECT) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (error) => {
      console.error('[WS] Lỗi WebSocket:', error.message);
      this.emit('error', error);
    });
  }

  private subscribeToGlobalTickers(): void {
    // SafeTrade WebSocket dùng format subscribe của Peatio/OpenDAX
    // Subscribe vào global.tickers để nhận cập nhật tất cả cặp
    const subscribeMsg = JSON.stringify({
      event: 'subscribe',
      streams: ['global.tickers'],
    });

    this.send(subscribeMsg);
    console.log('[WS] Đã gửi yêu cầu subscribe global.tickers...');
  }

  private handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object') return;
    
    const msg = message as Record<string, unknown>;

    // Xử lý ActionCable welcome/ping
    if (msg['type'] === 'welcome' || msg['type'] === 'ping') {
      return;
    }

    // Xử lý ticker update từ stream global.tickers
    // Format: { data: { global.tickers: { market: 'prlusdt', ... } } }
    if (msg['data'] && typeof msg['data'] === 'object') {
      const data = msg['data'] as Record<string, unknown>;
      
      // Kiểm tra format streams
      for (const key of Object.keys(data)) {
        if (key.includes('ticker') || key.includes('market')) {
          const tickerRaw = data[key] as Record<string, unknown>;
          if (tickerRaw && tickerRaw['result']) {
            const result = tickerRaw['result'] as Record<string, unknown>;
            const marketId = (tickerRaw['market'] as string) || key;
            this.emitTickerUpdate(marketId, result);
          }
        }
      }
    }

    // Format SafeTrade: { market: 'prlusdt', ticker: {...} }
    if (msg['market'] && msg['ticker']) {
      this.emitTickerUpdate(
        msg['market'] as string,
        msg['ticker'] as Record<string, unknown>
      );
    }

    // Format streams với method field
    if (msg['method'] === 'update' && msg['params']) {
      const params = msg['params'] as Record<string, unknown>;
      if (params['market'] && params['ticker']) {
        this.emitTickerUpdate(
          params['market'] as string,
          params['ticker'] as Record<string, unknown>
        );
      }
    }
  }

  private emitTickerUpdate(market: string, tickerData: Record<string, unknown>): void {
    const ticker: TickerData = {
      amount: String(tickerData['amount'] ?? '0'),
      avg_price: String(tickerData['avg_price'] ?? '0'),
      high: String(tickerData['high'] ?? '0'),
      last: String(tickerData['last'] ?? '0'),
      low: String(tickerData['low'] ?? '0'),
      open: String(tickerData['open'] ?? '0'),
      price_change_percent: String(tickerData['price_change_percent'] ?? '0%'),
      volume: String(tickerData['volume'] ?? '0'),
    };

    this.emit('ticker', { market: market.toLowerCase(), ticker } as TickerUpdateEvent);
  }

  private send(data: string): void {
    if (this.ws && this.isConnected) {
      this.ws.send(data);
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.isConnected && this.ws) {
        // ActionCable ping
        this.send(JSON.stringify({ command: 'ping' }));
      }
    }, this.PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.RECONNECT_DELAY_MS * this.reconnectAttempts;
    console.log(`[WS] Thử kết nối lại sau ${delay / 1000}s... (lần ${this.reconnectAttempts}/${this.MAX_RECONNECT})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    console.log('[WS] WebSocket đã ngắt kết nối.');
  }

  get connected(): boolean {
    return this.isConnected;
  }
}
