import { TickerData } from './types';

/**
 * Format giá với số thập phân phù hợp
 */
export function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '0';

  if (num < 0.0001) {
    return num.toFixed(8);
  } else if (num < 0.01) {
    return num.toFixed(6);
  } else if (num < 1) {
    return num.toFixed(4);
  } else if (num < 1000) {
    return num.toFixed(4);
  } else {
    return num.toFixed(2);
  }
}

/**
 * Format % thay đổi giá với emoji
 */
export function formatPriceChange(changePercent: string): string {
  const val = parseFloat(changePercent.replace('%', ''));
  if (isNaN(val)) return changePercent;

  const emoji = val > 0 ? '📈' : val < 0 ? '📉' : '➡️';
  const sign = val > 0 ? '+' : '';
  return `${emoji} ${sign}${val.toFixed(2)}%`;
}

/**
 * Format volume giao dịch
 */
export function formatVolume(volume: string | number): string {
  const num = typeof volume === 'string' ? parseFloat(volume) : volume;
  if (isNaN(num)) return '0';

  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toFixed(4);
}

/**
 * Tạo message hiển thị thông tin ticker đầy đủ
 */
export function formatTickerMessage(market: string, ticker: TickerData, includeHeader = true): string {
  const marketDisplay = market.toUpperCase().replace('-', '/');
  const price = formatPrice(ticker.last);
  const change = formatPriceChange(ticker.price_change_percent);
  const high = formatPrice(ticker.high);
  const low = formatPrice(ticker.low);
  const open = formatPrice(ticker.open);
  const avg = formatPrice(ticker.avg_price);
  const volume = formatVolume(ticker.volume);
  const amount = formatVolume(ticker.amount);
  
  const val = parseFloat(ticker.price_change_percent.replace('%', ''));
  const trendBar = val > 2 ? '🟢🟢🟢' : val > 0 ? '🟢' : val < -2 ? '🔴🔴🔴' : val < 0 ? '🔴' : '⚪';

  const header = includeHeader
    ? `🏦 *SafeTrade · ${marketDisplay}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n`
    : '';

  return (
    header +
    `💰 *Giá hiện tại:* \`${price} USDT\`\n` +
    `${change}  ${trendBar}\n\n` +
    `📊 *Thống kê 24h:*\n` +
    `├ 🔺 Cao nhất: \`${high}\`\n` +
    `├ 🔻 Thấp nhất: \`${low}\`\n` +
    `├ 🔓 Mở cửa: \`${open}\`\n` +
    `├ 📏 TB giá: \`${avg}\`\n` +
    `├ 📦 Volume: \`${volume} PRL\`\n` +
    `└ 💵 Khối lượng: \`${amount} USDT\`\n\n` +
    `🔗 [Xem trên SafeTrade](https://safetrade.com/exchange/PRL-USDT?type=basic)\n` +
    `🕐 _${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}_`
  );
}

/**
 * Tạo message cảnh báo giá
 */
export function formatAlertMessage(
  market: string,
  currentPrice: number,
  targetPrice: number,
  direction: 'above' | 'below'
): string {
  const marketDisplay = market.toUpperCase().replace('-', '/').replace('USDT', '/USDT');
  const emoji = direction === 'above' ? '🚀' : '⚠️';
  const dirText = direction === 'above' ? 'vượt lên trên' : 'giảm xuống dưới';

  return (
    `${emoji} *CẢNH BÁO GIÁ - ${marketDisplay}*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Giá đã ${dirText} ngưỡng đặt!\n\n` +
    `🎯 Ngưỡng đặt: \`${formatPrice(targetPrice)} USDT\`\n` +
    `💰 Giá hiện tại: \`${formatPrice(currentPrice)} USDT\`\n\n` +
    `🔗 [Xem trên SafeTrade](https://safetrade.com/exchange/PRL-USDT?type=basic)\n` +
    `🕐 _${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}_`
  );
}

/**
 * Parse giá từ chuỗi người dùng nhập
 */
export function parsePrice(input: string): number | null {
  const cleaned = input.trim().replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return null;
  return num;
}

/**
 * Normalize market ID
 */
export function normalizeMarketId(market: string): string {
  return market.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Hiển thị market dạng đẹp
 * Ví dụ: 'prl-usdt' → 'PRL/USDT', 'prlusdt' → 'PRL/USDT'
 */
export function displayMarket(market: string): string {
  // Chuẩn hoá: bỏ dấu gạch ngang/gạch dưới trước khi xử lý
  const cleaned = market.toUpperCase().replace(/[-_]/g, '');
  const knownPairs = ['USDT', 'BTC', 'ETH', 'BNB', 'USDC', 'EUR', 'TRY'];
  for (const quote of knownPairs) {
    if (cleaned.endsWith(quote)) {
      return `${cleaned.slice(0, cleaned.length - quote.length)}/${quote}`;
    }
  }
  return cleaned;
}
