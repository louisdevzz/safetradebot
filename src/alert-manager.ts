import { v4 as uuidv4 } from 'uuid';
import { PriceAlert, AlertDirection } from './types';

/**
 * AlertManager - Quản lý các cảnh báo giá của người dùng
 */
export class AlertManager {
  private alerts: Map<string, PriceAlert> = new Map();

  /**
   * Tạo cảnh báo giá mới
   */
  createAlert(
    chatId: number,
    market: string,
    targetPrice: number,
    direction: AlertDirection
  ): PriceAlert {
    const id = uuidv4();
    const alert: PriceAlert = {
      id,
      chatId,
      market: market.toLowerCase(),
      targetPrice,
      direction,
      createdAt: new Date(),
      triggered: false,
    };

    this.alerts.set(id, alert);
    return alert;
  }

  /**
   * Lấy tất cả cảnh báo của một chat
   */
  getAlertsByChatId(chatId: number): PriceAlert[] {
    return Array.from(this.alerts.values()).filter(
      (alert) => alert.chatId === chatId && !alert.triggered
    );
  }

  /**
   * Lấy tất cả cảnh báo theo market
   */
  getAlertsByMarket(market: string): PriceAlert[] {
    return Array.from(this.alerts.values()).filter(
      (alert) => alert.market === market.toLowerCase() && !alert.triggered
    );
  }

  /**
   * Xóa một cảnh báo theo ID
   */
  removeAlert(alertId: string, chatId: number): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.chatId !== chatId) return false;
    this.alerts.delete(alertId);
    return true;
  }

  /**
   * Đánh dấu cảnh báo đã kích hoạt
   */
  markTriggered(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.triggered = true;
    }
  }

  /**
   * Kiểm tra các cảnh báo với giá hiện tại
   * Trả về danh sách cảnh báo được kích hoạt
   */
  checkAlerts(market: string, currentPrice: number): PriceAlert[] {
    const triggered: PriceAlert[] = [];
    const marketAlerts = this.getAlertsByMarket(market);

    for (const alert of marketAlerts) {
      let shouldTrigger = false;

      if (alert.direction === 'above' && currentPrice >= alert.targetPrice) {
        shouldTrigger = true;
      } else if (alert.direction === 'below' && currentPrice <= alert.targetPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        this.markTriggered(alert.id);
        triggered.push(alert);
      }
    }

    return triggered;
  }

  /**
   * Xóa tất cả cảnh báo đã kích hoạt (cleanup)
   */
  cleanupTriggered(): void {
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.triggered) {
        this.alerts.delete(id);
      }
    }
  }

  get totalAlerts(): number {
    return this.alerts.size;
  }
}
