import "dotenv/config";
import { Telegraf, Context, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { safeTradeClient } from "./safetrade-client";
import { pearlHashClient } from "./pearlhash-client";
import { prlScanClient } from "./prlscan-client";
import { saladCloudClient } from "./saladcloud-client";
import { AlertManager } from "./alert-manager";
import { SafeTradeWebSocket, TickerUpdateEvent } from "./safetrade-ws";
import {
  formatTickerMessage,
  formatAlertMessage,
  formatMiningOverviewMessage,
  formatWorkersMessage,
  formatPendingRewardsMessage,
  formatPayoutsMessage,
  formatWalletInfoMessage,
  formatWalletTxsMessage,
  formatWalletActivityMessage,
  formatExchangeBalanceMessage,
  formatSaladGpuAvailabilityMessage,
  formatPrice,
  parsePrice,
  normalizeMarketId,
  displayMarket,
} from "./formatters";
import { TickerData } from "./types";

// =========================================
// Config
// =========================================
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_MARKET = process.env.MARKET_ID ?? "prl-usdt";
const DEFAULT_MARKET_ID = normalizeMarketId(DEFAULT_MARKET); // 'prlusdt'

// Địa chỉ mining mặc định (có thể cấu hình trong .env)
const DEFAULT_MINING_ADDRESS = process.env.MINING_ADDRESS ?? "";

if (!BOT_TOKEN) {
  console.error("❌ Lỗi: Thiếu TELEGRAM_BOT_TOKEN trong file .env");
  process.exit(1);
}

// =========================================
// State
// =========================================
const alertManager = new AlertManager();
const wsClient = new SafeTradeWebSocket();

// Giá hiện tại từ WebSocket / polling
let latestTicker: TickerData | null = null;
let latestPrice = 0;

// Map: chatId -> intervalId (cho /watch command)
const watchIntervals = new Map<number, ReturnType<typeof setInterval>>();

// Map: chatId -> địa chỉ mining riêng của user
const miningAddresses = new Map<number, string>();

// Pending state machine cho việc đặt alert
type PendingState =
  | { step: "waiting_direction" }
  | { step: "waiting_price"; direction: "above" | "below" };

const pendingAlerts = new Map<number, PendingState>();

// =========================================
// Bot
// =========================================
const bot = new Telegraf(BOT_TOKEN);

// =========================================
// Middleware: log
// =========================================
bot.use(async (ctx, next) => {
  const user = ctx.from;
  const text =
    ctx.text ??
    (ctx.callbackQuery && "data" in ctx.callbackQuery
      ? ctx.callbackQuery.data
      : undefined) ??
    "[no text]";
  if (user) {
    console.log(
      `[${new Date().toISOString()}] @${user.username ?? user.first_name} (${user.id}): ${text}`,
    );
  }
  await next();
});

// =========================================
// /start command
// =========================================
bot.start(async (ctx) => {
  const name = ctx.from?.first_name ?? "bạn";
  await ctx.replyWithMarkdown(
    `👋 Chào *${name}*! Tôi là bot theo dõi giá PRL/USDT trên SafeTrade.\n\n` +
    `📌 *Lệnh có sẵn:*\n\n` +
    `🔹 /price — Xem giá hiện tại PRL/USDT\n` +
    `🔹 /watch — Bắt đầu nhận thông báo giá mỗi 1 phút\n` +
    `🔹 /unwatch — Tắt thông báo tự động\n` +
    `🔹 /alert — Đặt cảnh báo khi giá đạt ngưỡng\n` +
    `🔹 /alerts — Xem danh sách cảnh báo\n` +
    `🔹 /delalert — Xóa cảnh báo\n` +
    `⛏️ /mining — Xem tổng quan mining PearlHash\n` +
    `🏦 /wallet — Xem số dư ví Pearl\n` +
    `📋 /payouts — Xem lịch sử giao dịch mining\n` +
    `⚙️ /setmining — Cài địa chỉ mining của bạn\n` +
    `🥗 /gpu — Xem GPU SaladCloud nào đang sẵn sàng\n` +
    `🔹 /help — Hướng dẫn sử dụng\n\n` +
    `_Nhấn /price để bắt đầu!_`
  );
});

// =========================================
// /help command
// =========================================
bot.help(async (ctx) => {
  await ctx.replyWithMarkdown(
    `📖 *Hướng dẫn sử dụng SafeTrade Price Bot*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `*Cặp theo dõi:* PRL/USDT trên SafeTrade\n\n` +

    `📊 *Xem giá SafeTrade:*\n` +
    `• /price — Xem giá PRL/USDT và thống kê 24h\n` +
    `• /watch [phút] — Nhận thông báo tự động\n` +
    `  Ví dụ: \`/watch 5\` (cập nhật mỗi 5 phút)\n` +
    `• /unwatch — Tắt thông báo tự động\n\n` +

    `⚠️ *Cảnh báo giá:*\n` +
    `• /alert above 0.05 — Cảnh báo khi giá > 0.05\n` +
    `• /alert below 0.03 — Cảnh báo khi giá < 0.03\n` +
    `• /alerts — Xem danh sách cảnh báo\n` +
    `• /delalert <id> — Xóa cảnh báo theo ID\n\n` +

    `⛏️ *Mining PearlHash:*\n` +
    `• /mining — Xem tổng quan mining (tổng hashrate, pending, 24h stats)\n` +
    `• /workers — Xem chi tiết các worker & GPU\n` +
    `• /rewards — Xem danh sách phần thưởng chờ trưởng thành\n` +
    `• /payouts — Xem lịch sử giao dịch gần nhất\n` +
    `• /setmining <địa_chỉ> — Cài địa chỉ PRL mining của bạn\n` +
    `  Ví dụ: \`/setmining prl1abc...xyz\`\n\n` +

    `🏦 *Theo dõi Ví (PRLScan):*\n` +
    `• /wallet — Xem số dư, tổng nhận/gửi\n` +
    `• /wallet_txs — Xem 10 giao dịch gần nhất\n` +
    `• /wallet_activity — Xem hoạt động ví 7 ngày qua\n\n` +

    `💼 *Sàn Giao Dịch (SafeTrade):*\n` +
    `• /balance — Xem số dư PRL và USDT trên sàn\n\n` +

    `🥗 *SaladCloud:*\n` +
    `• /gpu — Xem nhóm GPU nào đang có máy sẵn sàng cho tổ chức louisa\n\n` +

    `💡 *Mẹo:*\n` +
    `• Cảnh báo giá tự động xóa sau khi kích hoạt\n` +
    `• Địa chỉ mining được lưu cho mỗi người dùng riêng\n` +
    `• Lệnh /wallet dùng chung địa chỉ với /setmining\n` +
    `• Dùng nút 🔄 trên tin nhắn để làm mới dữ liệu`
  );
});

// =========================================
// /price command - Lấy giá hiện tại
// =========================================
bot.command("price", async (ctx) => {
  const loadingMsg = await ctx.reply("⏳ Đang lấy giá...");

  try {
    const ticker = await safeTradeClient.getTicker(DEFAULT_MARKET);
    latestTicker = ticker.ticker;
    latestPrice = parseFloat(ticker.ticker.last);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      formatTickerMessage(DEFAULT_MARKET, ticker.ticker),
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback("🔄 Làm mới", "refresh_price"),
            Markup.button.callback("🔔 Đặt cảnh báo", "set_alert"),
          ],
          [
            Markup.button.url(
              "📈 Mở SafeTrade",
              "https://safetrade.com/exchange/PRL-USDT?type=basic",
            ),
          ],
        ]).reply_markup,
      },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      `❌ Không thể lấy giá PRL/USDT.\nLỗi: ${errMsg}\n\nVui lòng thử lại sau.`,
    );
  }
});

// =========================================
// /watch command - Theo dõi tự động
// =========================================
bot.command("watch", async (ctx) => {
  const chatId = ctx.chat.id;
  const args = ctx.message.text.split(" ");
  const minutes = parseInt(args[1] ?? "1", 10);

  const intervalMs =
    Math.max(1, Math.min(60, isNaN(minutes) ? 1 : minutes)) * 60 * 1000;
  const intervalMinutes = intervalMs / 60000;

  // Hủy interval cũ nếu có
  if (watchIntervals.has(chatId)) {
    clearInterval(watchIntervals.get(chatId)!);
    watchIntervals.delete(chatId);
  }

  await ctx.reply(
    `✅ Bắt đầu theo dõi *PRL/USDT* mỗi *${intervalMinutes} phút*\\.\n` +
      `Nhấn /unwatch để tắt\\.`,
    { parse_mode: "MarkdownV2" },
  );

  // Gửi ngay lập tức lần đầu
  await sendPriceUpdate(ctx.chat.id, ctx);

  // Lên lịch gửi định kỳ
  const intervalId = setInterval(async () => {
    await sendPriceUpdate(chatId);
  }, intervalMs);

  watchIntervals.set(chatId, intervalId);
});

// =========================================
// /unwatch command - Tắt theo dõi tự động
// =========================================
bot.command("unwatch", async (ctx) => {
  const chatId = ctx.chat.id;

  if (!watchIntervals.has(chatId)) {
    await ctx.reply("ℹ️ Bạn chưa bật chế độ theo dõi tự động.");
    return;
  }

  clearInterval(watchIntervals.get(chatId)!);
  watchIntervals.delete(chatId);
  await ctx.reply("🔕 Đã tắt thông báo giá tự động cho PRL/USDT.");
});

// =========================================
// /alert command - Đặt cảnh báo giá
// Cú pháp: /alert above 0.05 hoặc /alert below 0.03
// =========================================
bot.command("alert", async (ctx) => {
  const chatId = ctx.chat.id;
  const args = ctx.message.text.trim().split(/\s+/).slice(1);

  // /alert above 0.05
  if (args.length >= 2) {
    const direction = args[0].toLowerCase();
    const priceStr = args[1];

    if (direction !== "above" && direction !== "below") {
      await ctx.reply(
        `❌ Hướng không hợp lệ\\. Dùng: \`above\` hoặc \`below\`\n\n` +
          `Ví dụ: /alert above 0\\.05`,
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    const targetPrice = parsePrice(priceStr);
    if (!targetPrice) {
      await ctx.reply("❌ Giá không hợp lệ. Vui lòng nhập số dương.");
      return;
    }

    const alert = alertManager.createAlert(
      chatId,
      DEFAULT_MARKET_ID,
      targetPrice,
      direction as "above" | "below",
    );
    const dirText = direction === "above" ? "vượt lên trên" : "giảm xuống dưới";
    const emoji = direction === "above" ? "🚀" : "📉";

    await ctx.replyWithMarkdown(
      `${emoji} *Cảnh báo đã được tạo!*\n\n` +
        `Cặp: \`PRL/USDT\`\n` +
        `Điều kiện: Khi giá ${dirText} \`${formatPrice(targetPrice)} USDT\`\n` +
        `ID: \`${alert.id.slice(0, 8)}\`\n\n` +
        `_Cảnh báo sẽ tự xóa sau khi kích hoạt._`,
    );
    return;
  }

  // Nếu không đủ args, hỏi interactive
  pendingAlerts.set(chatId, { step: "waiting_direction" });

  await ctx.reply(
    "📊 Bạn muốn đặt cảnh báo khi giá:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🚀 Tăng lên trên ngưỡng",
          "alert_direction_above",
        ),
        Markup.button.callback(
          "📉 Giảm xuống dưới ngưỡng",
          "alert_direction_below",
        ),
      ],
      [Markup.button.callback("❌ Hủy", "alert_cancel")],
    ]),
  );
});

// =========================================
// /alerts command - Xem danh sách cảnh báo
// =========================================
bot.command("alerts", async (ctx) => {
  const chatId = ctx.chat.id;
  const alerts = alertManager.getAlertsByChatId(chatId);

  if (alerts.length === 0) {
    await ctx.reply(
      "📭 Bạn chưa có cảnh báo nào.\n\nDùng /alert để đặt cảnh báo mới.",
    );
    return;
  }

  let msg = `🔔 *Danh sách cảnh báo PRL/USDT* (${alerts.length}):\n\n`;
  for (const alert of alerts) {
    const dirEmoji = alert.direction === "above" ? "🚀" : "📉";
    const dirText = alert.direction === "above" ? "Trên" : "Dưới";
    msg += `${dirEmoji} ${dirText} \`${formatPrice(alert.targetPrice)}\` USDT\n`;
    msg += `   ID: \`${alert.id.slice(0, 8)}\`\n\n`;
  }
  msg += `_Dùng /delalert <id> để xóa_`;

  await ctx.replyWithMarkdown(msg);
});

// =========================================
// /delalert command - Xóa cảnh báo
// =========================================
bot.command("delalert", async (ctx) => {
  const chatId = ctx.chat.id;
  const args = ctx.message.text.trim().split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      "❌ Vui lòng cung cấp ID cảnh báo.\nVí dụ: /delalert abc12345",
    );
    return;
  }

  const shortId = args[0].toLowerCase();
  const alerts = alertManager.getAlertsByChatId(chatId);
  const alert = alerts.find((a) => a.id.startsWith(shortId));

  if (!alert) {
    await ctx.reply(`❌ Không tìm thấy cảnh báo với ID: \`${shortId}\``, {
      parse_mode: "Markdown",
    });
    return;
  }

  const removed = alertManager.removeAlert(alert.id, chatId);
  if (removed) {
    await ctx.reply(`✅ Đã xóa cảnh báo \`${shortId}\``, {
      parse_mode: "Markdown",
    });
  } else {
    await ctx.reply("❌ Không thể xóa cảnh báo này.");
  }
});

// =========================================
// /setmining command - Cài địa chỉ mining
// =========================================
bot.command("setmining", async (ctx) => {
  const chatId = ctx.chat.id;
  const args = ctx.message.text.trim().split(/\s+/).slice(1);

  if (args.length === 0) {
    const current = miningAddresses.get(chatId) || DEFAULT_MINING_ADDRESS;
    const display = current
      ? `\`${current.slice(0, 12)}...${current.slice(-8)}\``
      : "_chưa được cài_";
    await ctx.replyWithMarkdown(
      `⚙️ *Cài địa chỉ mining PearlHash*\n\n` +
      `Địa chỉ hiện tại: ${display}\n\n` +
      `Dùng lệnh: \`/setmining <địa_chỉ>\`\n` +
      `Ví dụ:\n\`/setmining prl1abc...xyz\``
    );
    return;
  }

  const address = args[0].trim();
  if (!address.startsWith("prl1") || address.length < 20) {
    await ctx.reply("❌ Địa chỉ PRL không hợp lệ. Phải bắt đầu bằng `prl1`.", {
      parse_mode: "Markdown",
    });
    return;
  }

  miningAddresses.set(chatId, address);
  await ctx.replyWithMarkdown(
    `✅ *Đã lưu địa chỉ mining!*\n\n` +
    `\`${address.slice(0, 12)}...${address.slice(-8)}\`\n\n` +
    `Dùng /mining để xem thống kê.`
  );
});

// =========================================
// /mining command - Xem thông tin mining
// =========================================
bot.command("mining", async (ctx) => {
  const chatId = ctx.chat.id;
  // Ưu tiên địa chỉ riêng của user, sau đó dùng default từ .env
  const address = miningAddresses.get(chatId) || DEFAULT_MINING_ADDRESS;

  if (!address) {
    await ctx.replyWithMarkdown(
      `⛏️ *Chưa có địa chỉ mining!*\n\n` +
      `Dùng lệnh /setmining để cài địa chỉ PRL của bạn:\n` +
      `\`/setmining prl1abc...xyz\``
    );
    return;
  }

  const loadingMsg = await ctx.reply("⏳ Đang lấy dữ liệu mining...");

  try {
    const data = await pearlHashClient.getAccount(address);
    const msgText = formatMiningOverviewMessage(address, data);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      msgText,
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback("🔄 Làm mới", "refresh_mining"),
          ],
          [
            Markup.button.url(
              "🔗 Xem PearlHash",
              `https://pearlhash.xyz/account/${address}`
            ),
          ],
        ]).reply_markup,
      }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      `❌ Không thể lấy dữ liệu mining.\nLỗi: ${errMsg}\n\nVui lòng thử lại sau.`
    );
  }
});

// =========================================
// /workers command - Xem chi tiết workers
// =========================================
bot.command("workers", async (ctx) => {
  const chatId = ctx.chat.id;
  const address = miningAddresses.get(chatId) || DEFAULT_MINING_ADDRESS;

  if (!address) {
    await ctx.replyWithMarkdown(`⛏️ *Chưa cài địa chỉ!*\nDùng: \`/setmining prl1...\``);
    return;
  }

  const loadingMsg = await ctx.reply("⏳ Đang lấy dữ liệu workers...");
  try {
    const data = await pearlHashClient.getAccount(address);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, formatWorkersMessage(address, data), { parse_mode: "Markdown" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ Lỗi: ${errMsg}`);
  }
});

// =========================================
// /rewards command - Xem pending rewards
// =========================================
bot.command("rewards", async (ctx) => {
  const chatId = ctx.chat.id;
  const address = miningAddresses.get(chatId) || DEFAULT_MINING_ADDRESS;

  if (!address) {
    await ctx.replyWithMarkdown(`⛏️ *Chưa cài địa chỉ!*\nDùng: \`/setmining prl1...\``);
    return;
  }

  const loadingMsg = await ctx.reply("⏳ Đang lấy pending rewards...");
  try {
    const data = await pearlHashClient.getAccount(address);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, formatPendingRewardsMessage(address, data), { parse_mode: "Markdown" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ Lỗi: ${errMsg}`);
  }
});

// =========================================
// /payouts command - Xem lịch sử giao dịch
// =========================================
bot.command("payouts", async (ctx) => {
  const chatId = ctx.chat.id;
  const address = miningAddresses.get(chatId) || DEFAULT_MINING_ADDRESS;

  if (!address) {
    await ctx.replyWithMarkdown(`⛏️ *Chưa cài địa chỉ!*\nDùng: \`/setmining prl1...\``);
    return;
  }

  const loadingMsg = await ctx.reply("⏳ Đang lấy lịch sử giao dịch...");
  try {
    const data = await pearlHashClient.getAccount(address);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, formatPayoutsMessage(address, data), { parse_mode: "Markdown" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ Lỗi: ${errMsg}`);
  }
});

// =========================================
// /wallet command - Xem thông tin ví PRLScan
// =========================================
bot.command("wallet", async (ctx) => {
  const chatId = ctx.chat.id;
  const address = miningAddresses.get(chatId) || DEFAULT_MINING_ADDRESS;

  if (!address) {
    await ctx.replyWithMarkdown(`🏦 *Chưa cài địa chỉ ví!*\nDùng: \`/setmining prl1...\``);
    return;
  }

  const loadingMsg = await ctx.reply("⏳ Đang lấy thông tin ví từ PRLScan...");
  try {
    const data = await prlScanClient.getAddressInfo(address);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, formatWalletInfoMessage(data), { parse_mode: "Markdown" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ Lỗi PRLScan: ${errMsg}`);
  }
});

// =========================================
// /wallet_txs command - Xem giao dịch ví
// =========================================
bot.command("wallet_txs", async (ctx) => {
  const chatId = ctx.chat.id;
  const address = miningAddresses.get(chatId) || DEFAULT_MINING_ADDRESS;

  if (!address) {
    await ctx.replyWithMarkdown(`🏦 *Chưa cài địa chỉ ví!*\nDùng: \`/setmining prl1...\``);
    return;
  }

  const loadingMsg = await ctx.reply("⏳ Đang lấy lịch sử giao dịch ví...");
  try {
    const data = await prlScanClient.getTransactions(address, 10);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, formatWalletTxsMessage(address, data), { parse_mode: "Markdown" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ Lỗi PRLScan: ${errMsg}`);
  }
});

// =========================================
// /wallet_activity command - Xem biểu đồ hoạt động
// =========================================
bot.command("wallet_activity", async (ctx) => {
  const chatId = ctx.chat.id;
  const address = miningAddresses.get(chatId) || DEFAULT_MINING_ADDRESS;

  if (!address) {
    await ctx.replyWithMarkdown(`🏦 *Chưa cài địa chỉ ví!*\nDùng: \`/setmining prl1...\``);
    return;
  }

  const loadingMsg = await ctx.reply("⏳ Đang lấy hoạt động ví 7 ngày qua...");
  try {
    const data = await prlScanClient.getActivity(address, "day", 7);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, formatWalletActivityMessage(address, data), { parse_mode: "Markdown" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, `❌ Lỗi PRLScan: ${errMsg}`);
  }
});

// =========================================
// /balance command - Xem số dư trên SafeTrade
// =========================================
bot.command("balance", async (ctx) => {
  const loadingMsg = await ctx.reply("⏳ Đang lấy số dư từ SafeTrade...");
  try {
    const balances = await safeTradeClient.getBalances();
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      formatExchangeBalanceMessage(balances),
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      `❌ Lỗi kết nối SafeTrade: ${errMsg}`
    );
  }
});

// =========================================
// /gpu command - Xem tình trạng GPU SaladCloud
// =========================================
bot.command("gpu", async (ctx) => {
  const organizationName = saladCloudClient.configuredOrganizationName;
  const loadingMsg = await ctx.reply(
    `⏳ Đang kiểm tra GPU SaladCloud cho tổ chức ${organizationName}...`,
  );

  try {
    const items = await saladCloudClient.getAvailabilityByGpuClass();
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      formatSaladGpuAvailabilityMessage(organizationName, items),
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("🔄 Làm mới", "refresh_gpu_availability")],
        ]).reply_markup,
      },
    );
  } catch (error: any) {
    let errMsg = error instanceof Error ? error.message : String(error);
    if (error.code === 'ECONNABORTED') {
      errMsg = "Hết thời gian chờ (timeout). API SaladCloud phản hồi quá chậm hoặc kết nối mạng có vấn đề.";
    } else if (error.response) {
      errMsg = `Lỗi HTTP ${error.response.status}: ${error.response.statusText || error.response.data?.message || 'Không rõ nguyên nhân'}`;
    } else if (error.request) {
      errMsg = "Không thể kết nối đến SaladCloud API. Vui lòng kiểm tra kết nối mạng.";
    }
    
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      undefined,
      `❌ Không thể lấy tình trạng GPU SaladCloud.\nLỗi: ${errMsg}\n\nVui lòng kiểm tra lại SALAD_API_KEY trong .env (đảm bảo không có khoảng trắng thừa) và kết nối mạng.`,
    );
  }
});

// =========================================
// Callback Queries (Inline Buttons)
// =========================================
bot.action("refresh_price", async (ctx) => {
  await ctx.answerCbQuery("Đang làm mới...");
  try {
    const ticker = await safeTradeClient.getTicker(DEFAULT_MARKET);
    latestTicker = ticker.ticker;
    latestPrice = parseFloat(ticker.ticker.last);

    await ctx.editMessageText(
      formatTickerMessage(DEFAULT_MARKET, ticker.ticker),
      {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback("🔄 Làm mới", "refresh_price"),
            Markup.button.callback("🔔 Đặt cảnh báo", "set_alert"),
          ],
          [
            Markup.button.url(
              "📈 Mở SafeTrade",
              "https://safetrade.com/exchange/PRL-USDT?type=basic",
            ),
          ],
        ]).reply_markup,
      },
    );
  } catch {
    await ctx.answerCbQuery("❌ Lỗi khi làm mới giá");
  }
});

bot.action("set_alert", async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat!.id;
  pendingAlerts.set(chatId, { step: "waiting_direction" });

  await ctx.reply(
    "📊 Bạn muốn đặt cảnh báo khi giá:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "🚀 Tăng lên trên ngưỡng",
          "alert_direction_above",
        ),
        Markup.button.callback(
          "📉 Giảm xuống dưới ngưỡng",
          "alert_direction_below",
        ),
      ],
      [Markup.button.callback("❌ Hủy", "alert_cancel")],
    ]),
  );
});

bot.action("alert_direction_above", async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat!.id;
  pendingAlerts.set(chatId, { step: "waiting_price", direction: "above" });

  const priceHint =
    latestPrice > 0 ? ` (giá hiện tại: ${formatPrice(latestPrice)})` : "";
  await ctx.reply(
    `🚀 Cảnh báo khi giá *tăng lên trên* ngưỡng${priceHint}\n\n` +
      `Nhập giá ngưỡng bạn muốn cảnh báo (USDT):`,
    { parse_mode: "Markdown" },
  );
});

bot.action("alert_direction_below", async (ctx) => {
  await ctx.answerCbQuery();
  const chatId = ctx.chat!.id;
  pendingAlerts.set(chatId, { step: "waiting_price", direction: "below" });

  const priceHint =
    latestPrice > 0 ? ` (giá hiện tại: ${formatPrice(latestPrice)})` : "";
  await ctx.reply(
    `📉 Cảnh báo khi giá *giảm xuống dưới* ngưỡng${priceHint}\n\n` +
      `Nhập giá ngưỡng bạn muốn cảnh báo (USDT):`,
    { parse_mode: "Markdown" },
  );
});

bot.action("alert_cancel", async (ctx) => {
  await ctx.answerCbQuery("Đã hủy");
  const chatId = ctx.chat!.id;
  pendingAlerts.delete(chatId);
  await ctx.reply("❌ Đã hủy đặt cảnh báo.");
});

bot.action("refresh_mining", async (ctx) => {
  await ctx.answerCbQuery("Đang cập nhật...");
  const chatId = ctx.chat!.id;
  const address = miningAddresses.get(chatId) || DEFAULT_MINING_ADDRESS;

  if (!address) {
    await ctx.answerCbQuery("❌ Chưa có địa chỉ mining");
    return;
  }

  try {
    const data = await pearlHashClient.getAccount(address);
    const msgText = formatMiningOverviewMessage(address, data);

    await ctx.editMessageText(msgText, {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Làm mới", "refresh_mining")],
        [
          Markup.button.url(
            "🔗 Xem PearlHash",
            `https://pearlhash.xyz/account/${address}`
          ),
        ],
      ]).reply_markup,
    });
  } catch {
    await ctx.answerCbQuery("❌ Lỗi khi làm mới dữ liệu mining");
  }
});

bot.action("refresh_gpu_availability", async (ctx) => {
  await ctx.answerCbQuery("Đang cập nhật...");
  const organizationName = saladCloudClient.configuredOrganizationName;

  try {
    const items = await saladCloudClient.getAvailabilityByGpuClass();
    await ctx.editMessageText(formatSaladGpuAvailabilityMessage(organizationName, items), {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Làm mới", "refresh_gpu_availability")],
      ]).reply_markup,
    });
  } catch {
    await ctx.answerCbQuery("❌ Lỗi khi làm mới tình trạng GPU");
  }
});

// =========================================
// Text handler - Xử lý input giá cho alert
// =========================================
bot.on(message("text"), async (ctx) => {
  const chatId = ctx.chat.id;
  const state = pendingAlerts.get(chatId);

  if (!state || state.step !== "waiting_price") return;

  const targetPrice = parsePrice(ctx.message.text);
  if (!targetPrice) {
    await ctx.reply(
      "❌ Giá không hợp lệ. Vui lòng nhập số dương (ví dụ: 0.05)",
    );
    return;
  }

  const { direction } = state;
  pendingAlerts.delete(chatId);

  const alert = alertManager.createAlert(
    chatId,
    DEFAULT_MARKET_ID,
    targetPrice,
    direction,
  );
  const dirText = direction === "above" ? "tăng lên trên" : "giảm xuống dưới";
  const emoji = direction === "above" ? "🚀" : "📉";

  await ctx.replyWithMarkdown(
    `${emoji} *Cảnh báo đã được tạo!*\n\n` +
      `Cặp: \`PRL/USDT\`\n` +
      `Điều kiện: Khi giá ${dirText} \`${formatPrice(targetPrice)} USDT\`\n` +
      `ID: \`${alert.id.slice(0, 8)}\`\n\n` +
      `_Cảnh báo sẽ tự xóa sau khi kích hoạt._`,
  );
});

// =========================================
// Helper Functions
// =========================================

/**
 * Gửi cập nhật giá cho một chatId
 */
async function sendPriceUpdate(chatId: number, ctx?: Context): Promise<void> {
  try {
    const ticker = await safeTradeClient.getTicker(DEFAULT_MARKET);
    latestTicker = ticker.ticker;
    latestPrice = parseFloat(ticker.ticker.last);

    // Kiểm tra cảnh báo
    checkAndSendAlerts(latestPrice);

    const message = formatTickerMessage(DEFAULT_MARKET, ticker.ticker);

    if (ctx) {
      await ctx.replyWithMarkdown(message);
    } else {
      await bot.telegram.sendMessage(chatId, message, {
        parse_mode: "Markdown",
      });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Price Update] Lỗi cho chat ${chatId}:`, errMsg);

    if (!ctx) {
      await bot.telegram
        .sendMessage(
          chatId,
          `⚠️ Không thể lấy giá PRL/USDT lúc này. Sẽ thử lại sau.`,
        )
        .catch(() => {}); // Bỏ qua lỗi nếu không gửi được
    }
  }
}

/**
 * Kiểm tra và gửi thông báo cảnh báo giá
 */
async function checkAndSendAlerts(currentPrice: number): Promise<void> {
  const triggered = alertManager.checkAlerts(DEFAULT_MARKET_ID, currentPrice);

  for (const alert of triggered) {
    try {
      const msg = formatAlertMessage(
        DEFAULT_MARKET,
        currentPrice,
        alert.targetPrice,
        alert.direction,
      );

      await bot.telegram.sendMessage(alert.chatId, msg, {
        parse_mode: "Markdown",
      });
      console.log(
        `[Alert] Đã gửi cảnh báo cho chatId ${alert.chatId}: ${alert.direction} ${alert.targetPrice}`,
      );
    } catch (error) {
      console.error(
        `[Alert] Lỗi gửi cảnh báo cho chatId ${alert.chatId}:`,
        error,
      );
    }
  }

  // Cleanup alerts đã trigger
  alertManager.cleanupTriggered();
}

/**
 * Escape MarkdownV2 special characters
 */
function escapeMarkdown(text: string): string {
  // Chỉ escape các ký tự đặc biệt MarkdownV2 bên ngoài code spans
  return text.replace(/([_[\]()~`>#+=|{}.!-])/g, (match, char) => {
    // Không escape trong block đã được escape
    if (["*", "`", "\\"].includes(char)) return char;
    return match;
  });
}

// =========================================
// Background polling (backup khi WS thất bại)
// =========================================
let pollingActive = false;

async function startPolling(): Promise<void> {
  if (pollingActive) return;
  pollingActive = true;

  console.log("[Polling] Bắt đầu polling giá mỗi 30 giây...");

  // Polling mỗi 30 giây để kiểm tra alerts
  setInterval(async () => {
    try {
      const ticker = await safeTradeClient.getTicker(DEFAULT_MARKET);
      latestTicker = ticker.ticker;
      const price = parseFloat(ticker.ticker.last);

      if (price !== latestPrice) {
        latestPrice = price;
        await checkAndSendAlerts(latestPrice);
      }
    } catch {
      // Bỏ qua lỗi polling
    }
  }, 30_000);
}

// =========================================
// WebSocket Integration
// =========================================
function setupWebSocket(): void {
  wsClient.on("connected", () => {
    console.log("[WS] Đã kết nối WebSocket SafeTrade");
  });

  wsClient.on("ticker", (event: TickerUpdateEvent) => {
    if (
      (event.market.includes("prl") && event.market.includes("usdt")) ||
      event.market === DEFAULT_MARKET_ID
    ) {
      latestTicker = event.ticker;
      const price = parseFloat(event.ticker.last);

      if (price > 0 && price !== latestPrice) {
        latestPrice = price;
        checkAndSendAlerts(price).catch(console.error);
      }
    }
  });

  wsClient.on("error", (err: Error) => {
    console.error("[WS] WebSocket error:", err.message);
  });

  wsClient.on("disconnected", () => {
    console.log("[WS] WebSocket ngắt kết nối, đang dùng polling...");
  });

  // Thử kết nối WebSocket
  try {
    wsClient.connect();
  } catch (err) {
    console.warn("[WS] Không thể kết nối WebSocket, dùng polling thay thế");
  }
}

// =========================================
// Startup
// =========================================
async function main(): Promise<void> {
  console.log("🤖 SafeTrade Price Bot đang khởi động...");
  console.log(`📊 Theo dõi cặp: ${displayMarket(DEFAULT_MARKET)}`);

  // Khởi động WebSocket
  setupWebSocket();

  // Backup polling (luôn chạy song song)
  await startPolling();

  // Đăng ký menu commands với Telegram
  try {
    await bot.telegram.setMyCommands([
      { command: "price", description: "Xem giá hiện tại PRL/USDT" },
      { command: "mining", description: "Xem tổng quan PearlHash mining" },
      { command: "workers", description: "Xem chi tiết worker & GPU" },
      { command: "rewards", description: "Xem phần thưởng đang chờ" },
      { command: "payouts", description: "Xem lịch sử giao dịch mining" },
      { command: "wallet", description: "Xem số dư ví Pearl" },
      { command: "wallet_txs", description: "Xem giao dịch ví gần nhất" },
      { command: "wallet_activity", description: "Xem hoạt động ví 7 ngày qua" },
      { command: "balance", description: "Xem số dư PRL/USDT trên SafeTrade" },
      { command: "gpu", description: "Xem GPU SaladCloud đang sẵn sàng" },
      { command: "setmining", description: "Cài địa chỉ mining của bạn" },
      { command: "watch", description: "Bật thông báo giá tự động" },
      { command: "unwatch", description: "Tắt thông báo giá tự động" },
      { command: "alert", description: "Đặt cảnh báo giá" },
      { command: "alerts", description: "Xem danh sách cảnh báo" },
      { command: "delalert", description: "Xóa cảnh báo" },
      { command: "help", description: "Xem hướng dẫn sử dụng" },
    ]);
    console.log("✅ Đã đăng ký menu lệnh với Telegram");
  } catch (err) {
    console.error("⚠️ Không thể đăng ký menu lệnh:", err);
  }

  // Khởi động bot Telegram
  bot.launch({
    allowedUpdates: ["message", "callback_query"],
  });

  console.log("✅ Bot đã khởi động thành công!");
  console.log("💬 Telegram Bot đang chạy...");

  // Graceful shutdown
  process.once("SIGINT", () => {
    console.log("\n🛑 Đang tắt bot...");
    wsClient.disconnect();
    bot.stop("SIGINT");
  });

  process.once("SIGTERM", () => {
    console.log("\n🛑 Đang tắt bot (SIGTERM)...");
    wsClient.disconnect();
    bot.stop("SIGTERM");
  });
}

main().catch((err) => {
  console.error("❌ Lỗi khởi động:", err);
  process.exit(1);
});
