import axios, { AxiosInstance } from "axios";
import http from "http";
import https from "https";
import {
  SaladGpuAvailability,
  SaladGpuAvailabilityItem,
  SaladGpuAvailabilityRequest,
  SaladGpuClass,
  SaladGpuClassesResponse,
} from "./types";

const SALADCLOUD_BASE_URL = "https://api.salad.com/api/public";
const DEFAULT_ORGANIZATION_NAME = "louisa";

// Force IPv4 to prevent Node.js IPv6 resolution hangs
const httpAgent = new http.Agent({ family: 4 });
const httpsAgent = new https.Agent({ family: 4 });

/**
 * SaladCloudClient - Client kiểm tra GPU sẵn sàng theo tổ chức.
 */
export class SaladCloudClient {
  private readonly http: AxiosInstance;
  private readonly apiKey?: string;
  private readonly organizationName: string;

  constructor(
    baseUrl: string = SALADCLOUD_BASE_URL,
    apiKey: string | undefined = process.env.SALAD_API_KEY?.trim(),
    organizationName: string = process.env.SALAD_ORGANIZATION_NAME?.trim() ?? DEFAULT_ORGANIZATION_NAME,
  ) {
    this.apiKey = apiKey;
    this.organizationName = organizationName;
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 30_000,
      httpAgent,
      httpsAgent,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "SafeTradeBot/1.0",
      },
    });
  }

  get configuredOrganizationName(): string {
    return this.organizationName;
  }

  private authHeaders(): { "Salad-Api-Key": string } {
    if (!this.apiKey) {
      throw new Error("Chưa cấu hình SALAD_API_KEY trong .env");
    }
    return { "Salad-Api-Key": this.apiKey };
  }

  async listGpuClasses(): Promise<SaladGpuClass[]> {
    const response = await this.http.get<SaladGpuClassesResponse>(
      `/organizations/${this.organizationName}/gpu-classes`,
      { headers: this.authHeaders() },
    );
    return response.data.items;
  }

  async getGpuAvailability(request: SaladGpuAvailabilityRequest): Promise<SaladGpuAvailability> {
    const response = await this.http.post<SaladGpuAvailability>(
      `/organizations/${this.organizationName}/availability/sce-gpu-availability`,
      request,
      { headers: this.authHeaders() },
    );
    return response.data;
  }

  async getAvailabilityByGpuClass(): Promise<SaladGpuAvailabilityItem[]> {
    const gpuClasses = await this.listGpuClasses();
    const items: SaladGpuAvailabilityItem[] = [];

    // Process in batches of 5 to avoid Cloudflare rate limiting / connection dropping
    const batchSize = 5;
    for (let i = 0; i < gpuClasses.length; i += batchSize) {
      const batch = gpuClasses.slice(i, i + batchSize);
      const batchPromises = batch.map(async (gpuClass) => {
        try {
          const availability = await this.getGpuAvailability({
            gpu_classes: [gpuClass.id],
          });
          return { gpuClass, availability };
        } catch (error) {
          console.error(`[SaladCloud] Lỗi khi lấy availability cho ${gpuClass.name}:`, error);
          return null;
        }
      });
      
      const results = await Promise.all(batchPromises);
      items.push(...results.filter((r): r is SaladGpuAvailabilityItem => r !== null));
      
      // Small delay between batches to be polite to the API
      if (i + batchSize < gpuClasses.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return items;
  }
}

export const saladCloudClient = new SaladCloudClient();
