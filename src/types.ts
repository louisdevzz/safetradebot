// =========================================
// SafeTrade API Types
// =========================================

export interface TickerData {
  amount: string;       // Volume trong 24h
  avg_price: string;    // Giá trung bình 24h
  high: string;         // Giá cao nhất 24h
  last: string;         // Giá hiện tại (gần nhất)
  low: string;          // Giá thấp nhất 24h
  open: string;         // Giá mở cửa 24h
  price_change_percent: string; // % thay đổi giá 24h
  volume: string;       // Volume giao dịch
}

export interface TickerResponse {
  at: number;
  ticker: TickerData;
}

export interface WebSocketMessage {
  data?: {
    market?: string;
    result?: {
      amount: string;
      avg_price: string;
      high: string;
      last: string;
      low: string;
      open: string;
      price_change_percent: string;
      volume: string;
    };
  };
  event?: string;
  success?: boolean;
}

// =========================================
// Alert Types
// =========================================

export type AlertDirection = 'above' | 'below';

export interface PriceAlert {
  id: string;
  chatId: number;
  targetPrice: number;
  direction: AlertDirection;
  market: string;
  createdAt: Date;
  triggered: boolean;
}

export interface UserSubscription {
  chatId: number;
  market: string;
  intervalMs: number;
  active: boolean;
}

// =========================================
// Bot State Types
// =========================================

export interface BotState {
  subscriptions: Map<number, UserSubscription>;
  alerts: Map<string, PriceAlert>;
  lastKnownPrices: Map<string, number>;
  activeIntervals: Map<number, ReturnType<typeof setInterval>>;
}
