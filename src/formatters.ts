import {
  TickerData,
  MiningAccountData,
  ConnectedWorker,
  BalanceTransaction,
  PrlScanAddressInfo,
  PrlScanTxsResponse,
  PrlScanActivityResponse,
} from './types';

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

// =========================================
// PearlHash Mining Formatters
// =========================================

/**
 * Format hashrate từ H/s sang đơn vị dễ đọc (TH/s, PH/s)
 */
export function formatHashrate(hashrate: number): string {
  if (hashrate >= 1e15) return `${(hashrate / 1e15).toFixed(2)} PH/s`;
  if (hashrate >= 1e12) return `${(hashrate / 1e12).toFixed(2)} TH/s`;
  if (hashrate >= 1e9)  return `${(hashrate / 1e9).toFixed(2)} GH/s`;
  if (hashrate >= 1e6)  return `${(hashrate / 1e6).toFixed(2)} MH/s`;
  return `${hashrate.toFixed(0)} H/s`;
}

/**
 * Rút gọn tên GPU cho gọn
 */
function shortGpuName(name: string): string {
  return name
    .replace('NVIDIA ', '')
    .replace('GeForce ', '')
    .replace(' HBM3', '')
    .replace(' HBM2', '');
}

/**
 * Format thông tin 1 worker
 */
function formatWorker(worker: ConnectedWorker, index: number): string {
  const totalHashrate = worker.gpu_info.reduce((sum, g) => sum + g.hashrate, 0);
  const gpus = worker.gpu_info.map(g =>
    `  └ \`${shortGpuName(g.name)}\` · ${formatHashrate(g.hashrate)}`
  ).join('\n');
  return (
    `*Worker ${index + 1}* (v${worker.version})\n` +
    `  📡 Tổng: \`${formatHashrate(totalHashrate)}\`\n` +
    gpus
  );
}

/**
 * Format 1 giao dịch balance
 */
function formatTransaction(tx: BalanceTransaction): string {
  const isCredit = tx.amount > 0;
  const emoji = isCredit ? '🟢' : '🔴';
  const sign = isCredit ? '+' : '';
  const date = new Date(tx.timestamp).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  // Rút gọn lý do
  let reason = tx.reason;
  if (reason.includes('credit')) {
    // "Epoch 2026-06-01 18:00:00 UTC .. 2026-06-01 19:00:00 UTC credit"
    const match = reason.match(/(\d{2}:\d{2}:\d{2}) UTC \.\..*?(\d{2}:\d{2}:\d{2}) UTC/);
    reason = match ? `Epoch ${match[1]}→${match[2]}` : 'Epoch credit';
  } else if (reason.includes('Auto Payment')) {
    reason = 'Auto Payment';
  }
  return `${emoji} \`${sign}${Math.abs(tx.amount).toFixed(4)} PRL\` · ${reason} · _${date}_`;
}

/**
 * Format thông tin tổng quan (cho lệnh /mining)
 */
export function formatMiningOverviewMessage(
  address: string,
  data: MiningAccountData,
  shortAddress = true
): string {
  const addr = shortAddress
    ? `\`${address.slice(0, 12)}...${address.slice(-8)}\``
    : `\`${address}\``;

  const totalWorkers = data.connected_workers.length;
  const totalGpus = data.connected_workers.reduce(
    (sum, w) => sum + w.gpu_info.length, 0
  );
  const totalHashrate = data.connected_workers.reduce(
    (sum, w) => sum + w.gpu_info.reduce((s, g) => s + g.hashrate, 0), 0
  );

  const pending = data.pending_rewards;

  const now = Date.now();
  const earned24h = data.balance_transactions
    .filter(tx => tx.amount > 0 && now - tx.timestamp < 86_400_000)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const paid24h = data.balance_transactions
    .filter(tx => tx.amount < 0 && now - tx.timestamp < 86_400_000)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return (
    `⛏️ *PearlHash Mining Overview*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👛 Địa chỉ: ${addr}\n\n` +

    `📡 *Live Performance:*\n` +
    `├ 🖥️ Workers online: \`${totalWorkers}\`\n` +
    `├ 🎮 Tổng GPU: \`${totalGpus}\`\n` +
    `└ ⚡ Hashrate: \`${formatHashrate(totalHashrate)}\`\n\n` +

    `⏳ *Pending (Immature):* \`${pending.total_pending.toFixed(4)} PRL\`\n\n` +

    `📈 *24h Stats:*\n` +
    `├ ✅ Đã nhận: \`+${earned24h.toFixed(4)} PRL\`\n` +
    `└ 💸 Đã trả: \`-${paid24h.toFixed(4)} PRL\`\n\n` +

    `_Dùng /workers, /rewards, /payouts để xem chi tiết._\n` +
    `🔗 [Xem trên PearlHash](https://pearlhash.xyz/account/${address})\n` +
    `🕐 _${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}_`
  );
}

/**
 * Format thông tin chi tiết workers (cho lệnh /workers)
 */
export function formatWorkersMessage(address: string, data: MiningAccountData): string {
  const totalWorkers = data.connected_workers.length;
  
  if (totalWorkers === 0) {
    return `⛏️ *PearlHash Workers*\n━━━━━━━━━━━━━━━━━━━━\n❌ Không có worker nào đang online.`;
  }

  const workersSection = data.connected_workers.map((w, i) => formatWorker(w, i)).join('\n\n');

  return (
    `⛏️ *PearlHash Workers* (${totalWorkers})\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    workersSection + '\n\n' +
    `🕐 _${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}_`
  );
}

/**
 * Format pending rewards (cho lệnh /rewards)
 */
export function formatPendingRewardsMessage(address: string, data: MiningAccountData): string {
  const pending = data.pending_rewards;
  
  if (pending.epochs.length === 0) {
    return `⛏️ *Pending Rewards*\n━━━━━━━━━━━━━━━━━━━━\n_Không có phần thưởng nào đang chờ._`;
  }

  const pendingSection = pending.epochs.map(e => {
    // e.epoch_label: "2026-06-01 19:00:00 UTC .. 2026-06-01 20:00:00 UTC"
    const timeRange = e.epoch_label.match(/(\d{2}:\d{2}):\d{2} UTC \.\..*?(\d{2}:\d{2}):\d{2} UTC/);
    const label = timeRange ? `${timeRange[1]}→${timeRange[2]} UTC` : e.epoch_label;
    const sharePercent = (e.share * 100).toFixed(4);
    return `├ \`${label}\`\n│ └ \`${e.amount.toFixed(4)} PRL\` (${sharePercent}%)`;
  }).join('\n');

  return (
    `⏳ *Pending Rewards (Immature)*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Tổng:* \`${pending.total_pending.toFixed(4)} PRL\`\n\n` +
    pendingSection + '\n\n' +
    `🕐 _${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}_`
  );
}

/**
 * Format lịch sử giao dịch (cho lệnh /payouts)
 */
export function formatPayoutsMessage(address: string, data: MiningAccountData): string {
  const recentTxs = [...data.balance_transactions]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 15); // Lấy 15 tx gần nhất

  if (recentTxs.length === 0) {
    return `📋 *Lịch sử giao dịch*\n━━━━━━━━━━━━━━━━━━━━\n_Không có giao dịch nào._`;
  }

  const txSection = recentTxs.map(tx => formatTransaction(tx)).join('\n');

  return (
    `📋 *Lịch sử giao dịch (15 gần nhất)*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    txSection + '\n\n' +
    `🕐 _${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}_`
  );
}

// =========================================
// Wallet & PRLScan Formatters
// =========================================

/**
 * Đổi grains sang PRL (1 PRL = 100,000,000 grains)
 */
export function formatGrainsToPRL(grains: number): string {
  const prl = grains / 100_000_000;
  return prl.toFixed(4); // Lấy 4 số thập phân cho gọn
}

/**
 * Rút gọn địa chỉ ví
 */
export function shortWalletAddress(address: string): string {
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

/**
 * Format thông tin số dư /wallet
 */
export function formatWalletInfoMessage(info: PrlScanAddressInfo): string {
  const balance = formatGrainsToPRL(info.balance_grains);
  const totalReceived = formatGrainsToPRL(info.received_grains);
  const totalSent = formatGrainsToPRL(info.sent_grains);
  
  return (
    `🏦 *Wallet Thông Tin*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👛 Địa chỉ: \`${shortWalletAddress(info.address)}\`\n\n` +
    `💰 *Số dư:* \`${balance} PRL\`\n\n` +
    `📊 *Thống kê tổng quan:*\n` +
    `├ 📥 Đã nhận: \`${totalReceived} PRL\` (${info.transfer_in_tx_count} lần)\n` +
    `├ 📤 Đã gửi: \`${totalSent} PRL\` (${info.transfer_out_tx_count} lần)\n` +
    `└ 🔄 Tổng giao dịch: \`${info.tx_count}\`\n\n` +
    `🔗 [Xem trên PearlHash Explorer](https://explorer.pearlhash.xyz/address/${info.address})\n` +
    `🕐 _${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}_`
  );
}

/**
 * Format danh sách giao dịch /wallet_txs
 */
export function formatWalletTxsMessage(address: string, txsData: PrlScanTxsResponse): string {
  if (txsData.items.length === 0) {
    return `📋 *Giao dịch gần nhất*\n━━━━━━━━━━━━━━━━━━━━\n❌ Chưa có giao dịch nào.`;
  }

  // Lấy tối đa 10 giao dịch
  const txsSection = txsData.items.slice(0, 10).map(tx => {
    // Nếu nhận > gửi thì là giao dịch nhận (+), ngược lại là gửi (-)
    const isReceive = tx.delta_grains > 0;
    const emoji = isReceive ? '📥' : '📤';
    const sign = isReceive ? '+' : '-';
    const amountPrl = formatGrainsToPRL(Math.abs(tx.delta_grains));
    const date = new Date(tx.time).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    
    // Label type nếu có, không thì là 'Chuyển tiền'
    const label = tx.type_label || (isReceive ? 'Nhận tiền' : 'Gửi tiền');

    return `${emoji} \`${sign}${amountPrl} PRL\` · ${label} · _${date}_`;
  }).join('\n');

  return (
    `📋 *Giao dịch gần nhất (Max 10)*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👛 Địa chỉ: \`${shortWalletAddress(address)}\`\n\n` +
    txsSection + '\n\n' +
    `🔗 [Xem trên PearlHash Explorer](https://explorer.pearlhash.xyz/address/${address})\n` +
    `🕐 _${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}_`
  );
}

/**
 * Format biểu đồ / hoạt động 7 ngày qua /wallet_activity
 */
export function formatWalletActivityMessage(address: string, activityData: PrlScanActivityResponse): string {
  if (activityData.items.length === 0) {
    return `📉 *Hoạt động ví 7 ngày qua*\n━━━━━━━━━━━━━━━━━━━━\n❌ Không có dữ liệu hoạt động.`;
  }

  const actSection = activityData.items.map(item => {
    // Chỉ lấy ngày tháng cho ngắn
    const dateStr = item.time.substring(5, 10); // Lấy MM-DD từ YYYY-MM-DD
    const receivedPrl = formatGrainsToPRL(item.transfer_in_grains + item.mined_grains);
    const sentPrl = formatGrainsToPRL(item.sent_grains);
    
    // Nếu không có hoạt động thì trả về null để filter sau
    if (item.transfer_in_grains === 0 && item.sent_grains === 0 && item.mined_grains === 0) {
      return null;
    }

    return `📅 \`${dateStr}\` | Nhận: \`${receivedPrl}\` | Gửi: \`${sentPrl}\``;
  }).filter(line => line !== null);

  const finalSection = actSection.length > 0 
    ? actSection.join('\n') 
    : '_Không có hoạt động nào trong 7 ngày qua._';

  return (
    `📉 *Hoạt động ví (7 ngày)*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👛 Địa chỉ: \`${shortWalletAddress(address)}\`\n\n` +
    finalSection + '\n\n' +
    `🔗 [Xem trên PearlHash Explorer](https://explorer.pearlhash.xyz/address/${address})\n` +
    `🕐 _${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}_`
  );
}
