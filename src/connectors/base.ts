import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ApiResponse, AnalyticsData, PlatformCredentials, RateLimitConfig, SupportedPlatform } from '../types';
import { RateLimiter } from '../utils/rateLimiter';

export abstract class BaseConnector {
  protected platform: SupportedPlatform;
  protected credentials: PlatformCredentials;
  protected rateLimits: RateLimitConfig;
  protected httpClient: AxiosInstance;
  protected rateLimiter: RateLimiter;

  constructor(
    platform: SupportedPlatform,
    credentials: PlatformCredentials,
    rateLimits: RateLimitConfig,
    rateLimiter: RateLimiter
  ) {
    this.platform = platform;
    this.credentials = credentials;
    this.rateLimits = rateLimits;
    this.rateLimiter = rateLimiter;
    
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'InfluenceHub/1.0.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(async (config) => {
      await this.rateLimiter.waitForLimit(this.platform, this.rateLimits);
      return config;
    });

    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          console.warn(`Rate limit exceeded for ${this.platform}`);
        }
        return Promise.reject(error);
      }
    );
  }

  protected async makeRequest<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.httpClient.request<T>(config);
      const remaining = this.rateLimiter.getRemainingRequests(this.platform, this.rateLimits);
      const resetTimes = this.rateLimiter.getResetTime(this.platform);

      return {
        success: true,
        data: response.data,
        rate_limit: {
          remaining: remaining.hourly,
          reset_time: resetTimes.hourly
        }
      };
    } catch (error: any) {
      const result: ApiResponse<T> = {
        success: false,
        error: error.message || `API request failed for ${this.platform}`
      };
      
      if (error.response?.status === 429) {
        result.rate_limit = {
          remaining: 0,
          reset_time: new Date(Date.now() + 3600000)
        };
      }
      
      return result;
    }
  }

  abstract validateCredentials(): Promise<boolean>;
  abstract fetchAnalytics(timeRange?: string): Promise<ApiResponse<AnalyticsData>>;
  abstract fetchTrendingTopics(limit?: number): Promise<ApiResponse<any>>;
  abstract fetchUserMetrics(userId?: string): Promise<ApiResponse<any>>;

  public getPlatform(): SupportedPlatform {
    return this.platform;
  }

  public async testConnection(): Promise<boolean> {
    try {
      return await this.validateCredentials();
    } catch (error) {
      console.error(`Connection test failed for ${this.platform}:`, error);
      return false;
    }
  }
}