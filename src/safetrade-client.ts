import axios, { AxiosInstance } from 'axios';
import { TickerResponse } from './types';

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
}

export const safeTradeClient = new SafeTradeClient();
