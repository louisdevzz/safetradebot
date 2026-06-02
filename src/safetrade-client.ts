import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { TickerResponse, AccountBalance } from './types';

const SAFETRADE_BASE_URL = 'https://safetrade.com';

/**
 * SafeTradeClient - Client để gọi REST API của SafeTrade
 * Dùng cho public endpoints (không cần xác thực)
 */
export class SafeTradeClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string = SAFETRADE_BASE_URL) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'SafeTradeBot/1.0 (Telegram Price Tracker)',
      },
    });
  }

  /**
   * Lấy thông tin ticker của một cặp giao dịch
   * GET /api/v2/peatio/public/markets/{market}/tickers
   */
  async getTicker(market: string): Promise<TickerResponse> {
    const marketId = market.toLowerCase().replace('-', '').replace('_', '');
    const url = `/api/v2/peatio/public/markets/${marketId}/tickers`;
    
    try {
      const response = await this.http.get<TickerResponse>(url);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Thử format khác nếu thất bại
        const marketDash = market.toLowerCase().replace('_', '-');
        const urlDash = `/api/v2/peatio/public/markets/${marketDash}/tickers`;
        const response2 = await this.http.get<TickerResponse>(urlDash);
        return response2.data;
      }
      throw error;
    }
  }

  /**
   * Lấy danh sách tất cả markets
   * GET /api/v2/peatio/public/markets
   */
  async getMarkets(): Promise<Array<{ id: string; name: string; base_unit: string; quote_unit: string }>> {
    const response = await this.http.get('/api/v2/peatio/public/markets');
    return response.data;
  }

  /**
   * Lấy tất cả tickers cùng một lúc
   * GET /api/v2/peatio/public/markets/tickers
   */
  async getAllTickers(): Promise<Record<string, { at: number; ticker: TickerResponse['ticker'] }>> {
    const response = await this.http.get('/api/v2/peatio/public/markets/tickers');
    return response.data;
  }

  /**
   * Lấy số dư tài khoản
   * GET /api/v2/peatio/account/balances
   */
  async getBalances(): Promise<AccountBalance[]> {
    const apiKey = process.env.SAFETRADE_API_KEY;
    const secretKey = process.env.SAFETRADE_SECRET_KEY;

    if (!apiKey || !secretKey) {
      throw new Error("Chưa cấu hình SAFETRADE_API_KEY hoặc SAFETRADE_SECRET_KEY trong .env");
    }

    const nonce = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(nonce + apiKey)
      .digest('hex');

    const headers = {
      'X-Auth-Apikey': apiKey,
      'X-Auth-Nonce': nonce,
      'X-Auth-Signature': signature
    };

    const endpoint = '/api/v2/trade/balances';
    try {
      console.log(`[SafeTrade] Gọi endpoint: ${endpoint}`);
      const response = await this.http.get(endpoint, { headers });
      
      // Tùy thuộc vào cấu trúc trả về, xử lý lấy danh sách AccountBalance
      if (Array.isArray(response.data)) {
        return response.data as AccountBalance[];
      }
      if (response.data && Array.isArray(response.data.accounts)) {
        return response.data.accounts as AccountBalance[];
      }
      return []; // Fallback
    } catch (err: any) {
      const status = err.response?.status;
      const errorData = err.response?.data;
      console.log(`[SafeTrade] Lỗi ${status}:`, errorData);
      
      if (status === 401) {
        if (errorData?.errors?.includes('authz.invalid_permission')) {
          throw new Error("API Key không có quyền (Permission). Hãy vào sàn cấp quyền 'Read Balance' hoặc 'Trade' cho API Key.");
        }
        throw new Error("API Key hoặc Secret Key không chính xác (Lỗi 401).");
      }
      
      throw new Error(err.message || "Lỗi không xác định");
    }
  }
}

export const safeTradeClient = new SafeTradeClient();
