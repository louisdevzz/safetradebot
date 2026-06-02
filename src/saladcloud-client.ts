import axios, { AxiosInstance } from "axios";
import {
  SaladGpuAvailability,
  SaladGpuAvailabilityItem,
  SaladGpuAvailabilityRequest,
  SaladGpuClass,
  SaladGpuClassesResponse,
} from "./types";

const SALADCLOUD_BASE_URL = "https://api.salad.com/api/public";
const DEFAULT_ORGANIZATION_NAME = "louisa";

/**
 * SaladCloudClient - Client kiểm tra GPU sẵn sàng theo tổ chức.
 */
export class SaladCloudClient {
  private readonly http: AxiosInstance;
  private readonly apiKey?: string;
  private readonly organizationName: string;

  constructor(
    baseUrl: string = SALADCLOUD_BASE_URL,
    apiKey: string | undefined = process.env.SALAD_API_KEY,
    organizationName: string = process.env.SALAD_ORGANIZATION_NAME ?? DEFAULT_ORGANIZATION_NAME,
  ) {
    this.apiKey = apiKey;
    this.organizationName = organizationName;
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 15_000,
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

    for (const gpuClass of gpuClasses) {
      const availability = await this.getGpuAvailability({
        gpu_classes: [gpuClass.id],
      });
      items.push({ gpuClass, availability });
    }

    return items;
  }
}

export const saladCloudClient = new SaladCloudClient();
