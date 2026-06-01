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

// =========================================
// PearlHash Mining Pool Types
// =========================================

export interface GpuInfo {
  name: string;       // Tên GPU (e.g. "NVIDIA H100 80GB HBM3")
  hashrate: number;   // Hashrate tính bằng H/s
}

export interface ConnectedWorker {
  ip: string;
  worker_name: string;
  worker_id: number;
  version: string;
  gpu_info: GpuInfo[];
}

export interface BalanceTransaction {
  amount: number;     // Dương = credit, Âm = payment
  reason: string;     // Mô tả (epoch credit hoặc Auto Payment)
  timestamp: number;  // Unix ms
}

export interface PendingEpoch {
  epoch_label: string;   // "2026-06-01 19:00:00 UTC .. 2026-06-01 20:00:00 UTC"
  amount: number;        // PRL ước tính
  share: number;         // Tỷ lệ share (0.0001 = 0.01%)
  immature_tx: number;   // Số tx chưa chín muồi
}

export interface PendingRewards {
  total_pending: number;
  epochs: PendingEpoch[];
}

export interface MiningAccountData {
  connected_workers: ConnectedWorker[];
  balance_transactions: BalanceTransaction[];
  pending_rewards: PendingRewards;
}
