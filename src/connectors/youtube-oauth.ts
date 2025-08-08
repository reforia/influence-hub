import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { BaseConnector } from './base';
import { ApiResponse, AnalyticsData, PlatformCredentials, TrendData } from '../types';
import { RateLimiter } from '../utils/rateLimiter';

interface YouTubeOAuthCredentials extends PlatformCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
  access_token?: string;
  refresh_token?: string;
}

export class YouTubeOAuthConnector extends BaseConnector {
  private oauth2Client: OAuth2Client;
  private youtube: any;

  constructor(credentials: YouTubeOAuthCredentials, rateLimiter: RateLimiter) {
    super(
      'youtube',
      credentials,
      { requestsPerHour: 10000, requestsPerDay: 1000000 },
      rateLimiter
    );

    // Set up OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri || 'http://localhost:3002/auth/youtube/callback'
    );

    // Set credentials if we have them
    if (credentials.access_token) {
      this.oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token
      });
    }

    // Initialize YouTube API client
    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client
    });
  }

  // Generate OAuth URL for user authorization
  public generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.channel-memberships.creator',
      'https://www.googleapis.com/auth/youtubepartner'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange authorization code for tokens
  public async exchangeCodeForTokens(code: string): Promise<{ access_token: string; refresh_token?: string }> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    
    return {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined
    };
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Try to get channel information with timeout
      const response = await Promise.race([
        this.youtube.channels.list({
          part: ['id', 'snippet'],
          mine: true
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Validation timeout')), 10000)
        )
      ]) as any;
      
      return response.data.items && response.data.items.length > 0;
    } catch (error) {
      console.error('YouTube OAuth validation failed:', (error as Error).message);
      return false;
    }
  }

  async fetchAnalytics(timeRange = '365'): Promise<ApiResponse<AnalyticsData>> {
    try {
      console.log('🎥 YouTube OAuth fetchAnalytics started');
      // Get channel info
      console.log('🎥 Fetching channel info...');
      const channelResponse = await this.youtube.channels.list({
        part: ['id', 'snippet', 'statistics'],
        mine: true
      });

      if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
        console.log('🎥 No channel found in response');
        return { success: false, error: 'No channel found' };
      }

      console.log(`🎥 Found channel with ${channelResponse.data.items[0].statistics?.viewCount} total views`);

      const channel = channelResponse.data.items[0];
      const stats = channel.statistics;

      // Get uploaded videos and filter by timeRange
      console.log(`🎥 Fetching videos for timeRange: ${timeRange} days...`);
      const uploadsResult = await this.getUploadedVideos(50);
      
      const videos = [];
      if (uploadsResult.success && uploadsResult.data) {
        console.log(`🎥 Found ${uploadsResult.data.length} total videos`);
        
        // Filter videos by timeRange
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));
        
        const filteredVideos = uploadsResult.data.filter((video: any) => 
          new Date(video.publishedAt) >= cutoffDate
        );
        
        console.log(`🎥 Using ${filteredVideos.length} videos from last ${timeRange} days (filtered from ${uploadsResult.data.length} total)`);
        
        // Convert to analytics format
        videos.push(...filteredVideos.map((video: any) => ({
          id: video.id,
          content: video.title,
          timestamp: new Date(video.publishedAt),
          metrics: {
            likes: video.statistics.likeCount,
            comments: video.statistics.commentCount,
            views: video.statistics.viewCount,
            shares: 0
          },
          engagement_rate: video.engagementRate,
          url: video.url,
          thumbnail: video.thumbnails?.medium?.url
        })));
      }

      // Calculate totals from video data if channel stats are 0 or unreliable
      const calculatedViews = videos.reduce((sum, v) => sum + v.metrics.views, 0);
      const channelViews = parseInt(stats.viewCount || '0');
      const finalViews = Math.max(channelViews, calculatedViews);
      
      console.log(`🎥 Views calculation: channel=${channelViews}, calculated=${calculatedViews}, final=${finalViews}`);
      
      const analyticsData: AnalyticsData = {
        platform: 'youtube',
        timestamp: new Date(),
        metrics: {
          followers: parseInt(stats.subscriberCount || '0'),
          views: finalViews, // Use whichever is higher
          likes: videos.reduce((sum, v) => sum + v.metrics.likes, 0),
          comments: videos.reduce((sum, v) => sum + v.metrics.comments, 0),
          engagement_rate: videos.length > 0 ? 
            videos.reduce((sum, v) => sum + v.engagement_rate, 0) / videos.length : 0
        },
        posts: videos
      };

      return { success: true, data: analyticsData };
    } catch (error: any) {
      console.error('🎥 YouTube analytics fetch error:', error.message);
      console.error('🎥 Full error:', error);
      return { success: false, error: error.message };
    }
  }

  async fetchTrendingTopics(limit = 50): Promise<ApiResponse<TrendData[]>> {
    try {
      // Get popular videos in your region
      const response = await this.youtube.videos.list({
        part: ['snippet', 'statistics'],
        chart: 'mostPopular',
        regionCode: 'US',
        maxResults: limit,
        videoCategoryId: '0' // All categories
      });

      if (!response.data.items) {
        return { success: false, error: 'No trending data available' };
      }

      const trends: TrendData[] = [];
      const tagCounts: Record<string, number> = {};

      response.data.items.forEach((video: any) => {
        if (video.snippet.tags) {
          video.snippet.tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + parseInt(video.statistics.viewCount || '0');
          });
        }

        // Also add video titles as trending topics
        if (video.snippet.title) {
          const title = video.snippet.title;
          trends.push({
            topic: title,
            mentions: parseInt(video.statistics.viewCount || '0'),
            sentiment: 'neutral',
            growth_rate: 0,
            hashtags: video.snippet.tags || []
          });
        }
      });

      // Add trending tags
      Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit / 2)
        .forEach(([tag, mentions]) => {
          trends.push({
            topic: tag,
            mentions,
            sentiment: 'neutral',
            growth_rate: 0,
            hashtags: [tag]
          });
        });

      return { success: true, data: trends.slice(0, limit) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async fetchUserMetrics(channelId?: string): Promise<ApiResponse<any>> {
    try {
      const params: any = {
        part: ['statistics', 'snippet', 'contentDetails']
      };

      if (channelId) {
        params.id = channelId;
      } else {
        params.mine = true;
      }

      const response = await this.youtube.channels.list(params);
      return { success: true, data: response.data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Get user's uploaded videos
  async getUploadedVideos(maxResults = 50): Promise<ApiResponse<any[]>> {
    try {
      // First get the uploads playlist ID
      const channelResponse = await this.youtube.channels.list({
        part: ['contentDetails'],
        mine: true
      });

      if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
        return { success: false, error: 'No channel found' };
      }

      const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;

      // Get videos from uploads playlist
      const playlistResponse = await this.youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: uploadsPlaylistId,
        maxResults: maxResults
      });

      if (!playlistResponse.data.items) {
        return { success: true, data: [] };
      }

      // Get detailed statistics for each video
      const videoIds = playlistResponse.data.items.map((item: any) => item.snippet.resourceId.videoId);
      
      const videoDetails = await this.youtube.videos.list({
        part: ['statistics', 'snippet', 'contentDetails'],
        id: videoIds.join(',')
      });

      const videos = videoDetails.data.items?.map((video: any) => ({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        publishedAt: video.snippet.publishedAt,
        thumbnails: video.snippet.thumbnails,
        duration: video.contentDetails.duration,
        statistics: {
          viewCount: parseInt(video.statistics.viewCount || '0'),
          likeCount: parseInt(video.statistics.likeCount || '0'),
          commentCount: parseInt(video.statistics.commentCount || '0')
        },
        url: `https://youtube.com/watch?v=${video.id}`,
        engagementRate: this.calculateEngagementRate(video.statistics)
      })) || [];

      return { success: true, data: videos };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private calculateEngagementRate(stats: any): number {
    const views = parseInt(stats.viewCount || '0');
    const likes = parseInt(stats.likeCount || '0');
    const comments = parseInt(stats.commentCount || '0');
    
    if (views === 0) return 0;
    return ((likes + comments) / views) * 100;
  }
}