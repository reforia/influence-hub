import { BaseConnector } from './base';
import { ApiResponse, AnalyticsData, PlatformCredentials, RateLimitConfig, SupportedPlatform, TrendData } from '../types';
import { RateLimiter } from '../utils/rateLimiter';

interface YouTubeChannelStats {
  viewCount: string;
  subscriberCount: string;
  videoCount: string;
}

interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
    description: string;
    tags?: string[];
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
}

export class YouTubeConnector extends BaseConnector {
  constructor(credentials: PlatformCredentials, rateLimiter: RateLimiter) {
    super(
      'youtube',
      credentials,
      { requestsPerHour: 10000, requestsPerDay: 1000000 },
      rateLimiter
    );
  }

  async validateCredentials(): Promise<boolean> {
    try {
      console.log('🎥 YouTube validation - API key present:', !!this.credentials.api_key);
      
      // Try a simple quota-using endpoint that works with API key only
      const response = await this.makeRequest({
        method: 'GET',
        url: 'https://www.googleapis.com/youtube/v3/videos',
        params: {
          part: 'id',
          chart: 'mostPopular',
          regionCode: 'US',
          maxResults: 1,
          key: this.credentials.api_key
        }
      });

      console.log('🎥 YouTube API response:', {
        success: response.success,
        error: response.error
      });

      return response.success;
    } catch (error) {
      console.error('🎥 YouTube validation exception:', error);
      return false;
    }
  }

  async fetchAnalytics(timeRange = '28'): Promise<ApiResponse<AnalyticsData>> {
    try {
      const channelResponse = await this.makeRequest<{ items: Array<{ id: string; statistics: YouTubeChannelStats }> }>({
        method: 'GET',
        url: 'https://www.googleapis.com/youtube/v3/channels',
        params: {
          part: 'statistics',
          mine: true,
          key: this.credentials.api_key
        }
      });

      if (!channelResponse.success || !channelResponse.data?.items?.[0]) {
        return { success: false, error: 'Failed to fetch channel statistics' };
      }

      const stats = channelResponse.data.items[0].statistics;
      
      const videosResponse = await this.makeRequest<{ items: YouTubeVideo[] }>({
        method: 'GET',
        url: 'https://www.googleapis.com/youtube/v3/search',
        params: {
          part: 'id',
          channelId: channelResponse.data.items[0].id,
          order: 'date',
          maxResults: 50,
          type: 'video',
          publishedAfter: new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString(),
          key: this.credentials.api_key
        }
      });

      const analyticsData: AnalyticsData = {
        platform: 'youtube',
        timestamp: new Date(),
        metrics: {
          followers: parseInt(stats.subscriberCount),
          views: parseInt(stats.viewCount),
        },
        posts: [] // Simplified for now - video details require proper search response handling
      };

      return { success: true, data: analyticsData };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async fetchTrendingTopics(limit = 50): Promise<ApiResponse<TrendData[]>> {
    try {
      const response = await this.makeRequest<{ items: YouTubeVideo[] }>({
        method: 'GET',
        url: 'https://www.googleapis.com/youtube/v3/videos',
        params: {
          part: 'snippet,statistics',
          chart: 'mostPopular',
          regionCode: 'US',
          maxResults: limit,
          key: this.credentials.api_key
        }
      });

      if (!response.success) {
        return { success: false, error: 'Failed to fetch trending topics' };
      }

      const trends: TrendData[] = [];
      const tagCounts: Record<string, number> = {};

      response.data?.items?.forEach(video => {
        if (video.snippet.tags) {
          video.snippet.tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + parseInt(video.statistics.viewCount);
          });
        }
      });

      Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .forEach(([topic, mentions]) => {
          trends.push({
            topic,
            mentions,
            sentiment: 'neutral',
            growth_rate: 0,
            hashtags: [topic]
          });
        });

      return { success: true, data: trends };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async fetchUserMetrics(channelId?: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: 'https://www.googleapis.com/youtube/v3/channels',
        params: {
          part: 'statistics,snippet',
          id: channelId,
          key: this.credentials.api_key
        }
      });

      return response;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async getVideoDetails(videoIds: Array<{ id: { videoId: string } }>): Promise<any[]> {
    if (!videoIds.length) return [];

    const ids = videoIds.map(v => v.id.videoId).join(',');
    const response = await this.makeRequest<{ items: YouTubeVideo[] }>({
      method: 'GET',
      url: 'https://www.googleapis.com/youtube/v3/videos',
      params: {
        part: 'snippet,statistics',
        id: ids,
        key: this.credentials.api_key
      }
    });

    if (!response.success || !response.data?.items) return [];

    return response.data.items.map(video => ({
      id: video.id,
      content: video.snippet.title,
      timestamp: new Date(video.snippet.publishedAt),
      metrics: {
        likes: parseInt(video.statistics.likeCount || '0'),
        comments: parseInt(video.statistics.commentCount || '0'),
        views: parseInt(video.statistics.viewCount || '0'),
        shares: 0
      },
      engagement_rate: this.calculateEngagementRate(video.statistics)
    }));
  }

  private calculateEngagementRate(stats: YouTubeVideo['statistics']): number {
    const views = parseInt(stats.viewCount || '0');
    const likes = parseInt(stats.likeCount || '0');
    const comments = parseInt(stats.commentCount || '0');
    
    if (views === 0) return 0;
    return ((likes + comments) / views) * 100;
  }
}