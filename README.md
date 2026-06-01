# 🤖 SafeTrade Price Bot

Bot Telegram theo dõi giá **PRL/USDT** realtime trên [SafeTrade](https://safetrade.com/exchange/PRL-USDT?type=basic).

## ✨ Tính năng

- 📊 **Xem giá realtime** - Giá, % thay đổi, high/low 24h, volume
- 🔔 **Theo dõi tự động** - Nhận thông báo giá định kỳ (1-60 phút)
- ⚠️ **Cảnh báo thông minh** - Đặt ngưỡng giá cảnh báo tự động
- 🔄 **Làm mới tại chỗ** - Button inline làm mới không cần gõ lệnh
- 🌐 **WebSocket + REST** - Dùng WS realtime, backup bằng polling

## 📦 Cài đặt

### Yêu cầu
- Node.js >= 18
- pnpm >= 8

### Bước 1: Clone và cài dependencies
```bash
git clone <repo>
cd safetradebot
pnpm install
```

### Bước 2: Tạo Telegram Bot
1. Nhắn tin với [@BotFather](https://t.me/BotFather) trên Telegram
2. Dùng lệnh `/newbot` để tạo bot mới
3. Copy Bot Token nhận được

### Bước 3: Cấu hình
```bash
cp .env.example .env
# Chỉnh sửa file .env và điền TELEGRAM_BOT_TOKEN
```

### Bước 4: Chạy bot
```bash
# Development mode
pnpm dev:watch

# Production (build trước)
pnpm build
pnpm start
```

## 🎮 Lệnh sử dụng

| Lệnh | Mô tả |
|------|-------|
| `/start` | Xem menu chính |
| `/price` | Xem giá PRL/USDT hiện tại |
| `/watch [phút]` | Bật thông báo định kỳ (mặc định: 1 phút) |
| `/unwatch` | Tắt thông báo định kỳ |
| `/alert above 0.05` | Cảnh báo khi giá > 0.05 USDT |
| `/alert below 0.03` | Cảnh báo khi giá < 0.03 USDT |
| `/alerts` | Xem danh sách cảnh báo |
| `/delalert <id>` | Xóa cảnh báo theo ID |
| `/help` | Hướng dẫn chi tiết |

## 🏗️ Cấu trúc dự án

```
safetradebot/
├── src/
│   ├── index.ts              # Bot chính (commands, handlers)
│   ├── safetrade-client.ts   # REST API client
│   ├── safetrade-ws.ts       # WebSocket client realtime
│   ├── alert-manager.ts      # Quản lý cảnh báo giá
│   ├── formatters.ts         # Format tin nhắn, giá, emoji
│   └── types.ts              # TypeScript types
├── .env.example              # Mẫu cấu hình
├── tsconfig.json             # TypeScript config
└── package.json
```

## 🔧 Scripts

```bash
pnpm dev:watch    # Chạy development với ts-node
pnpm build        # Build production
pnpm start        # Chạy production build
pnpm typecheck    # Kiểm tra TypeScript
```

## 📡 API SafeTrade

Bot sử dụng endpoint công khai (không cần API key):
- `GET /api/v2/peatio/public/markets/{market}/tickers` - Lấy ticker
- WebSocket: `wss://safetrade.com/cable` - Realtime updates

## 📝 License

MIT
