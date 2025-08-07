import { BaseConnector } from './base';
import { ApiResponse, AnalyticsData, PlatformCredentials, TrendData } from '../types';
import { RateLimiter } from '../utils/rateLimiter';
import { createHash, createHmac } from 'crypto';

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
}

interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
  entities?: {
    hashtags?: Array<{ tag: string }>;
  };
}

export class TwitterConnector extends BaseConnector {
  constructor(credentials: PlatformCredentials, rateLimiter: RateLimiter) {
    super(
      'twitter',
      credentials,
      { requestsPerHour: 300, requestsPerDay: 500 },
      rateLimiter
    );
    
    this.setupAuth();
  }

  private setupAuth(): void {
    this.httpClient.defaults.headers.common['Authorization'] = 
      `Bearer ${this.credentials.access_token}`;
  }

  async validateCredentials(): Promise<boolean> {
    const response = await this.makeRequest({
      method: 'GET',
      url: 'https://api.twitter.com/2/users/me',
      headers: {
        'Authorization': `Bearer ${this.credentials.access_token}`
      }
    });

    return response.success;
  }

  async fetchAnalytics(timeRange = '7'): Promise<ApiResponse<AnalyticsData>> {
    try {
      const userResponse = await this.makeRequest<{ data: TwitterUser }>({
        method: 'GET',
        url: 'https://api.twitter.com/2/users/me',
        params: {
          'user.fields': 'public_metrics'
        }
      });

      if (!userResponse.success) {
        return { success: false, error: 'Failed to fetch user data' };
      }

      const startTime = new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString();
      
      const tweetsResponse = await this.makeRequest<{ data: TwitterTweet[] }>({
        method: 'GET',
        url: `https://api.twitter.com/2/users/${userResponse.data?.data.id}/tweets`,
        params: {
          'tweet.fields': 'created_at,public_metrics,entities',
          'start_time': startTime,
          'max_results': 100
        }
      });

      const user = userResponse.data!.data;
      const tweets = tweetsResponse.data?.data || [];

      const totalEngagement = tweets.reduce((sum, tweet) => 
        sum + tweet.public_metrics.like_count + 
        tweet.public_metrics.retweet_count + 
        tweet.public_metrics.reply_count, 0
      );

      const analyticsData: AnalyticsData = {
        platform: 'twitter',
        timestamp: new Date(),
        metrics: {
          followers: user.public_metrics.followers_count,
          likes: totalEngagement,
          shares: tweets.reduce((sum, tweet) => sum + tweet.public_metrics.retweet_count, 0),
          comments: tweets.reduce((sum, tweet) => sum + tweet.public_metrics.reply_count, 0),
          engagement_rate: user.public_metrics.followers_count > 0 ? 
            (totalEngagement / user.public_metrics.followers_count) * 100 : 0
        },
        posts: tweets.map(tweet => ({
          id: tweet.id,
          content: tweet.text,
          timestamp: new Date(tweet.created_at),
          metrics: {
            likes: tweet.public_metrics.like_count,
            shares: tweet.public_metrics.retweet_count,
            comments: tweet.public_metrics.reply_count,
            views: 0
          },
          engagement_rate: this.calculateEngagementRate(tweet.public_metrics)
        }))
      };

      return { success: true, data: analyticsData };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async fetchTrendingTopics(limit = 50): Promise<ApiResponse<TrendData[]>> {
    try {
      const response = await this.makeRequest<{ data: Array<{ value: string; tweet_count: number }> }>({
        method: 'GET',
        url: 'https://api.twitter.com/1.1/trends/place.json',
        params: {
          id: 1
        }
      });

      if (!response.success) {
        return { success: false, error: 'Failed to fetch trending topics' };
      }

      const trends: TrendData[] = response.data?.data?.slice(0, limit).map(trend => ({
        topic: trend.value,
        mentions: trend.tweet_count,
        sentiment: 'neutral',
        growth_rate: 0,
        hashtags: [trend.value]
      })) || [];

      return { success: true, data: trends };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async fetchUserMetrics(username?: string): Promise<ApiResponse<any>> {
    try {
      const response = await this.makeRequest({
        method: 'GET',
        url: `https://api.twitter.com/2/users/by/username/${username}`,
        params: {
          'user.fields': 'public_metrics,created_at,description'
        }
      });

      return response;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private calculateEngagementRate(metrics: TwitterTweet['public_metrics']): number {
    const totalEngagement = metrics.like_count + metrics.retweet_count + metrics.reply_count;
    return totalEngagement;
  }

  async searchTweets(query: string, maxResults = 100): Promise<ApiResponse<{ data: TwitterTweet[] }>> {
    try {
      const response = await this.makeRequest<{ data: TwitterTweet[] }>({
        method: 'GET',
        url: 'https://api.twitter.com/2/tweets/search/recent',
        params: {
          query,
          'tweet.fields': 'created_at,public_metrics,entities',
          max_results: Math.min(maxResults, 100)
        }
      });

      return response;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}