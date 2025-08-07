export interface Platform {
  id: string;
  name: string;
  enabled: boolean;
  credentials?: PlatformCredentials;
  rateLimits?: RateLimitConfig;
}

export interface PlatformCredentials {
  [key: string]: string;
}

export interface RateLimitConfig {
  requestsPerHour: number;
  requestsPerDay: number;
  resetTime?: Date;
}

export interface AnalyticsData {
  platform: string;
  timestamp: Date;
  metrics: {
    followers?: number;
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
    engagement_rate?: number;
    reach?: number;
    impressions?: number;
  };
  trends?: TrendData[];
  posts?: PostData[];
}

export interface TrendData {
  topic: string;
  mentions: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  growth_rate: number;
  hashtags?: string[];
}

export interface PostData {
  id: string;
  content: string;
  timestamp: Date;
  metrics: {
    likes: number;
    shares: number;
    comments: number;
    views?: number;
  };
  engagement_rate: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rate_limit?: {
    remaining: number;
    reset_time: Date;
  };
}

export interface ConnectorConfig {
  platform: string;
  credentials: PlatformCredentials;
  endpoints: {
    [key: string]: string;
  };
  rateLimits: RateLimitConfig;
}

export type SupportedPlatform = 
  | 'facebook'
  | 'youtube'
  | 'twitter'
  | 'reddit'
  | 'tiktok'
  | 'instagram'
  | 'discord';

export interface McpToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}