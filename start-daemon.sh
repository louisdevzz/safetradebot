#!/bin/bash

# Hiển thị màu sắc
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== SafeTrade Price Bot - Daemon Setup ===${NC}"

# Bước 1: Build code TypeScript sang JavaScript (thư mục dist)
echo -e "${GREEN}1. Đang build source code...${NC}"
pnpm build
if [ $? -ne 0 ]; then
    echo "❌ Lỗi khi build code. Hãy kiểm tra lại."
    exit 1
fi

# Bước 2: Khởi động PM2 thông qua npx
echo -e "${GREEN}2. Khởi động bot dưới nền (daemon) với PM2...${NC}"
npx pm2 start ecosystem.config.js

# Bước 3: Hướng dẫn
echo -e "\n${BLUE}=== Thành công ===${NC}"
echo -e "Bot đã chạy ngầm! Nó sẽ tự động khởi động lại nếu bị crash."
echo -e "Các lệnh hữu ích để quản lý bot:"
echo -e "  ${GREEN}pnpm daemon:logs${NC}    - Xem log trực tiếp của bot"
echo -e "  ${GREEN}pnpm daemon:stop${NC}    - Dừng bot"
echo -e "  ${GREEN}pnpm daemon:restart${NC} - Khởi động lại bot"
echo -e "  ${GREEN}npx pm2 status${NC}      - Xem trạng thái các app đang chạy nền"
