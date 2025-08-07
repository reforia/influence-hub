import { BaseConnector } from './base';
import { ApiResponse, AnalyticsData, PlatformCredentials, TrendData } from '../types';
import { RateLimiter } from '../utils/rateLimiter';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  created_utc: number;
  score: number;
  num_comments: number;
  subreddit: string;
  author: string;
  url: string;
  ups: number;
  downs: number;
}

interface RedditSubreddit {
  display_name: string;
  subscribers: number;
  active_user_count: number;
  created_utc: number;
  public_description: string;
}

export class RedditConnector extends BaseConnector {
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor(credentials: PlatformCredentials, rateLimiter: RateLimiter) {
    super(
      'reddit',
      credentials,
      { requestsPerHour: 600, requestsPerDay: 1000 },
      rateLimiter
    );
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.credentials.client_id}:${this.credentials.client_secret}`).toString('base64');
    
    const response = await this.makeRequest<{ access_token: string; expires_in: number }>({
      method: 'POST',
      url: 'https://www.reddit.com/api/v1/access_token',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'InfluenceHub/1.0.0 by YourUsername'
      },
      data: new URLSearchParams({
        grant_type: 'password',
        username: this.credentials.username || '',
        password: this.credentials.password || ''
      }).toString()
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to obtain Reddit access token');
    }

    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
    
    return this.accessToken;
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      
      const response = await this.makeRequest({
        method: 'GET',
        url: 'https://oauth.reddit.com/api/v1/me',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'InfluenceHub/1.0.0 by YourUsername'
        }
      });

      return response.success;
    } catch (error) {
      return false;
    }
  }

  async fetchAnalytics(timeRange = '7'): Promise<ApiResponse<AnalyticsData>> {
    try {
      const token = await this.getAccessToken();
      const timeFilter = this.getRedditTimeFilter(parseInt(timeRange));

      const userResponse = await this.makeRequest<{ name: string; link_karma: number; comment_karma: number }>({
        method: 'GET',
        url: 'https://oauth.reddit.com/api/v1/me',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'InfluenceHub/1.0.0 by YourUsername'
        }
      });

      if (!userResponse.success) {
        return { success: false, error: 'Failed to fetch user data' };
      }

      const postsResponse = await this.makeRequest<{ data: { children: Array<{ data: RedditPost }> } }>({
        method: 'GET',
        url: `https://oauth.reddit.com/user/${userResponse.data?.name}/submitted`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'InfluenceHub/1.0.0 by YourUsername'
        },
        params: {
          sort: 'new',
          t: timeFilter,
          limit: 100
        }
      });

      const posts = postsResponse.data?.data?.children?.map(child => child.data) || [];
      const totalScore = posts.reduce((sum, post) => sum + post.score, 0);
      const totalComments = posts.reduce((sum, post) => sum + post.num_comments, 0);

      const analyticsData: AnalyticsData = {
        platform: 'reddit',
        timestamp: new Date(),
        metrics: {
          likes: totalScore,
          comments: totalComments,
          engagement_rate: posts.length > 0 ? (totalScore + totalComments) / posts.length : 0
        },
        posts: posts.map(post => ({
          id: post.id,
          content: post.title,
          timestamp: new Date(post.created_utc * 1000),
          metrics: {
            likes: post.score,
            shares: 0,
            comments: post.num_comments,
            views: 0
          },
          engagement_rate: post.score + post.num_comments
        }))
      };

      return { success: true, data: analyticsData };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async fetchTrendingTopics(limit = 25): Promise<ApiResponse<TrendData[]>> {
    try {
      const token = await this.getAccessToken();

      const response = await this.makeRequest<{ 
        data: { 
          children: Array<{ 
            data: RedditPost 
          }> 
        } 
      }>({
        method: 'GET',
        url: 'https://oauth.reddit.com/r/all/hot',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'InfluenceHub/1.0.0 by YourUsername'
        },
        params: {
          limit
        }
      });

      if (!response.success || !response.data?.data?.children) {
        return { success: false, error: 'Failed to fetch trending topics' };
      }

      const trends: TrendData[] = response.data.data.children.map(child => ({
        topic: child.data.title,
        mentions: child.data.score,
        sentiment: child.data.score > 100 ? 'positive' : 'neutral',
        growth_rate: 0,
        hashtags: [child.data.subreddit]
      }));

      return { success: true, data: trends };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async fetchUserMetrics(username?: string): Promise<ApiResponse<any>> {
    try {
      const token = await this.getAccessToken();
      const user = username || 'me';
      const url = username ? 
        `https://oauth.reddit.com/user/${username}/about` : 
        'https://oauth.reddit.com/api/v1/me';

      const response = await this.makeRequest({
        method: 'GET',
        url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'InfluenceHub/1.0.0 by YourUsername'
        }
      });

      return response;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async searchSubreddit(subreddit: string, query?: string, limit = 25): Promise<ApiResponse<RedditPost[]>> {
    try {
      const token = await this.getAccessToken();
      const url = query ? 
        `https://oauth.reddit.com/r/${subreddit}/search` :
        `https://oauth.reddit.com/r/${subreddit}/hot`;

      const params: any = { limit };
      if (query) {
        params.q = query;
        params.restrict_sr = true;
      }

      const response = await this.makeRequest<{ data: { children: Array<{ data: RedditPost }> } }>({
        method: 'GET',
        url,
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'InfluenceHub/1.0.0 by YourUsername'
        },
        params
      });

      if (!response.success || !response.data?.data?.children) {
        return { success: false, error: 'Failed to search subreddit' };
      }

      const posts = response.data.data.children.map(child => child.data);
      return { success: true, data: posts };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private getRedditTimeFilter(days: number): string {
    if (days <= 1) return 'day';
    if (days <= 7) return 'week';
    if (days <= 30) return 'month';
    if (days <= 365) return 'year';
    return 'all';
  }
}