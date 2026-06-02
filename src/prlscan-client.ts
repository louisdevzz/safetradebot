import axios, { AxiosInstance } from "axios";
import { PrlScanAddressInfo, PrlScanTxsResponse, PrlScanActivityResponse } from "./types";

const PRLSCAN_BASE_URL = "https://api.prlscan.com/v1";

/**
 * PrlScanClient - Client gọi API prlscan.com
 */
export class PrlScanClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string = PRLSCAN_BASE_URL) {
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
   * Xem thông tin ví
   */
  async getAddressInfo(address: string): Promise<PrlScanAddressInfo> {
    const response = await this.http.get<PrlScanAddressInfo>(
      `/addresses/${address}`
    );
    return response.data;
  }

  /**
   * Xem danh sách giao dịch
   */
  async getTransactions(address: string, limit: number = 10): Promise<PrlScanTxsResponse> {
    const response = await this.http.get<PrlScanTxsResponse>(
      `/addresses/${address}/txs`,
      { params: { limit } }
    );
    return response.data;
  }

  /**
   * Xem biểu đồ hoạt động
   */
  async getActivity(address: string, bucket: string = "day", days: number = 7): Promise<PrlScanActivityResponse> {
    const response = await this.http.get<PrlScanActivityResponse>(
      `/addresses/${address}/activity`,
      { params: { bucket, days } }
    );
    return response.data;
  }
}

export const prlScanClient = new PrlScanClient();
