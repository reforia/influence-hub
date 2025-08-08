import { BaseConnector } from './base';
import { ApiResponse, AnalyticsData, PlatformCredentials, TrendData } from '../types';
import { RateLimiter } from '../utils/rateLimiter';

interface FacebookPage {
  id: string;
  name: string;
  fan_count: number;
  talking_about_count: number;
  category: string;
  link: string;
}

interface FacebookPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  type: string;
  link?: string;
  picture?: string;
  reactions?: {
    summary: {
      total_count: number;
    };
  };
  shares?: {
    count: number;
  };
  comments?: {
    summary: {
      total_count: number;
    };
  };
}

interface FacebookInsights {
  data: Array<{
    name: string;
    values: Array<{
      value: number;
      end_time: string;
    }>;
  }>;
}

export class FacebookConnector extends BaseConnector {
  constructor(credentials: PlatformCredentials, rateLimiter: RateLimiter) {
    super(
      'facebook',
      credentials,
      { requestsPerHour: 200, requestsPerDay: 1000 },
      rateLimiter
    );
    
    this.setupAuth();
  }

  private setupAuth(): void {
    if (this.credentials.access_token) {
      this.httpClient.defaults.headers.common['Authorization'] = 
        `Bearer ${this.credentials.access_token}`;
      console.log('✓ Using Facebook User Access Token');
    } else {
      console.log('⚠️ No Facebook access token found');
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: 'https://graph.facebook.com/v18.0/me',
        params: {
          fields: 'id,name,email',
          access_token: this.credentials.access_token
        }
      });
      
      if (response.success) {
        console.log('✓ Facebook validation successful for:', (response.data as any)?.name);
        return true;
      } else {
        console.error('❌ Facebook validation failed:', response.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Facebook validation exception:', (error as any).response?.data || (error as any).message);
      return false;
    }
  }

  async fetchAnalytics(timeRange = '7'): Promise<ApiResponse<AnalyticsData>> {
    try {
      // First get user's pages
      const pagesResponse = await this.makeRequest<{ data: FacebookPage[] }>({
        method: 'GET',
        url: 'https://graph.facebook.com/v18.0/me/accounts',
        params: {
          fields: 'id,name,fan_count,talking_about_count,category,link',
          access_token: this.credentials.access_token
        }
      });

      if (!pagesResponse.success || !pagesResponse.data?.data) {
        return { success: false, error: 'Failed to fetch Facebook pages' };
      }

      const pages = pagesResponse.data.data;
      console.log('✓ Got Facebook pages:', pages.length);

      if (pages.length === 0) {
        // If no pages, try to get personal profile posts (limited)
        return await this.fetchPersonalPosts(timeRange);
      }

      // Use the first page for now
      const page = pages[0];
      console.log('✓ Using page:', page.name);

      // Get page posts
      const postsResponse = await this.makeRequest<{ data: FacebookPost[] }>({
        method: 'GET',
        url: `https://graph.facebook.com/v18.0/${page.id}/posts`,
        params: {
          fields: 'id,message,story,created_time,type,link,picture,reactions.summary(true),shares,comments.summary(true)',
          limit: 25,
          access_token: this.credentials.access_token
        }
      });

      const posts = postsResponse.success ? (postsResponse.data?.data || []) : [];
      console.log('✓ Got Facebook posts:', posts.length);

      // Calculate metrics
      const totalReactions = posts.reduce((sum, post) => 
        sum + (post.reactions?.summary.total_count || 0), 0
      );
      
      const totalShares = posts.reduce((sum, post) => 
        sum + (post.shares?.count || 0), 0
      );
      
      const totalComments = posts.reduce((sum, post) => 
        sum + (post.comments?.summary.total_count || 0), 0
      );

      const analyticsData: AnalyticsData = {
        platform: 'facebook',
        timestamp: new Date(),
        metrics: {
          followers: page.fan_count || 0,
          likes: totalReactions,
          shares: totalShares,
          comments: totalComments,
          engagement_rate: page.fan_count > 0 ? 
            ((totalReactions + totalShares + totalComments) / page.fan_count) * 100 : 0
        },
        posts: posts.map((post) => ({
          id: post.id,
          content: post.message || post.story || 'No content available',
          timestamp: new Date(post.created_time),
          metrics: {
            likes: post.reactions?.summary.total_count || 0,
            shares: post.shares?.count || 0,
            comments: post.comments?.summary.total_count || 0,
            views: 0 // Facebook doesn't provide view counts in basic API
          },
          engagement_rate: this.calculateEngagementRate({
            likes: post.reactions?.summary.total_count || 0,
            shares: post.shares?.count || 0,
            comments: post.comments?.summary.total_count || 0
          })
        }))
      };

      return { success: true, data: analyticsData };
    } catch (error: any) {
      console.error('Facebook fetchAnalytics error:', error.response?.status, error.message);
      return { success: false, error: `Facebook API error: ${error.response?.status || 'Unknown'} - ${error.message}` };
    }
  }

  private async fetchPersonalPosts(timeRange: string): Promise<ApiResponse<AnalyticsData>> {
    try {
      // For personal profiles, we have very limited access
      // Try to get basic user info only
      const userResponse = await this.makeRequest({
        method: 'GET',
        url: 'https://graph.facebook.com/v18.0/me',
        params: {
          fields: 'id,name,email',
          access_token: this.credentials.access_token
        }
      });

      if (!userResponse.success) {
        return { success: false, error: 'Failed to fetch user data' };
      }

      const analyticsData: AnalyticsData = {
        platform: 'facebook',
        timestamp: new Date(),
        metrics: {
          followers: 0,
          likes: 0,
          shares: 0,
          comments: 0,
          engagement_rate: 0
        },
        posts: [{
          id: 'personal-profile',
          content: `Connected to Facebook profile: ${(userResponse.data as any)?.name}`,
          timestamp: new Date(),
          metrics: { likes: 0, shares: 0, comments: 0, views: 0 },
          engagement_rate: 0
        }]
      };

      return { success: true, data: analyticsData };
    } catch (error: any) {
      return { success: false, error: `Facebook personal data error: ${error.message}` };
    }
  }

  async fetchTrendingTopics(limit = 50): Promise<ApiResponse<TrendData[]>> {
    // Facebook doesn't provide public trending topics through their API
    // This would require advanced business API access
    return { 
      success: true, 
      data: [{
        topic: 'Facebook Trends',
        mentions: 0,
        sentiment: 'neutral' as const,
        growth_rate: 0,
        hashtags: ['facebook']
      }] 
    };
  }

  async fetchUserMetrics(userId?: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: `https://graph.facebook.com/v18.0/${userId || 'me'}`,
        params: {
          fields: 'id,name,email,link',
          access_token: this.credentials.access_token
        }
      });

      return response;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private calculateEngagementRate(metrics: { likes: number; shares: number; comments: number }): number {
    return metrics.likes + metrics.shares + metrics.comments;
  }

  async searchPosts(query: string, maxResults = 100): Promise<ApiResponse<{ data: FacebookPost[] }>> {
    // Facebook search requires special permissions and is limited
    return { 
      success: false, 
      error: 'Facebook post search requires advanced API access' 
    };
  }
}