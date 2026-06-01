import axios, { AxiosInstance } from "axios";
import { MiningAccountData } from "./types";

const PEARLHASH_BASE_URL = "https://pearlhash.xyz";

/**
 * PearlHashClient - Client lấy thông tin account từ pearlhash.xyz
 */
export class PearlHashClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string = PEARLHASH_BASE_URL) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 10_000,
      headers: {
        "Accept": "application/json",
        "User-Agent": "SafeTradeBot/1.0",
      },
    });
  }

  /**
   * Lấy toàn bộ thông tin account mining
   * GET /api/account/{address}
   */
  async getAccount(address: string): Promise<MiningAccountData> {
    const response = await this.http.get<MiningAccountData>(
      `/api/account/${address}`
    );
    return response.data;
  }
}

export const pearlHashClient = new PearlHashClient();
