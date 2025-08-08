import { AnalyticsData, TrendData, SupportedPlatform, ApiResponse } from '../types';
import { BaseConnector } from '../connectors/base';

export interface AggregatedMetrics {
  totalFollowers: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  totalViews: number;
  averageEngagementRate: number;
  platformBreakdown: Record<SupportedPlatform, AnalyticsData>;
  crossPlatformTrends: TrendData[];
  insights: string[];
  lastUpdated: Date;
}

export interface TrendingInsights {
  emergingTopics: TrendData[];
  growingHashtags: string[];
  sentimentAnalysis: {
    positive: number;
    negative: number;
    neutral: number;
  };
  bestPerformingContent: Array<{
    platform: SupportedPlatform;
    content: string;
    engagementRate: number;
    timestamp: Date;
  }>;
  recommendations: string[];
}

export class AnalyticsAggregator {
  private connectors: Map<SupportedPlatform, BaseConnector> = new Map();
  private cache: Map<string, { data: any; timestamp: Date; ttl: number }> = new Map();
  private twitterCache: { data: AnalyticsData | null; timestamp: Date | null } = { data: null, timestamp: null };

  public addConnector(platform: SupportedPlatform, connector: BaseConnector): void {
    this.connectors.set(platform, connector);
  }

  public removeConnector(platform: SupportedPlatform): void {
    this.connectors.delete(platform);
  }

  public async aggregateAllMetrics(timeRange = '7'): Promise<ApiResponse<AggregatedMetrics>> {
    try {
      const cacheKey = `metrics-${timeRange}-${Array.from(this.connectors.keys()).join(',')}`;
      const cached = this.getCached(cacheKey, 120000); // Reduced to 2 minutes for faster updates
      if (cached) {
        console.log('📦 Returning cached analytics data');
        return { success: true, data: cached };
      }
      
      console.log('🔄 Fetching fresh analytics data from all platforms...');

      const platformData: Record<SupportedPlatform, AnalyticsData> = {} as Record<SupportedPlatform, AnalyticsData>;
      const allTrends: TrendData[] = [];
      let totalFollowers = 0;
      let totalLikes = 0;
      let totalShares = 0;
      let totalComments = 0;
      let totalViews = 0;
      let totalEngagementRates = 0;
      let validPlatforms = 0;

      // Create parallel promises for all platforms
      const platformPromises = Array.from(this.connectors.entries()).map(async ([platform, connector]) => {
        try {
          let analyticsResponse: ApiResponse<AnalyticsData>;
          let trendsResponse: ApiResponse<any> = { success: false, error: 'Skipped' };
          
          // Handle Twitter specially to avoid rate limits
          if (platform === 'twitter') {
            try {
              console.log('🐦 Aggregator attempting Twitter analytics...');
              analyticsResponse = await connector.fetchAnalytics(timeRange);
              if (analyticsResponse.success && analyticsResponse.data) {
                // Cache successful Twitter data
                this.twitterCache.data = analyticsResponse.data;
                this.twitterCache.timestamp = new Date();
                console.log('✅ Twitter analytics cached by aggregator');
              }
            } catch (error: any) {
              console.log('⚠️ Twitter analytics failed in aggregator, using cached data...');
              if (this.twitterCache.data) {
                analyticsResponse = { success: true, data: this.twitterCache.data };
                console.log(`📦 Using cached Twitter data from ${this.twitterCache.timestamp?.toLocaleString()}`);
              } else {
                analyticsResponse = { success: false, error: error.message };
                console.log('❌ No cached Twitter data available');
              }
            }
            // Skip trends for Twitter to avoid additional API calls
          } else {
            // For non-Twitter platforms, fetch both analytics and trends in parallel
            const [analytics, trends] = await Promise.all([
              connector.fetchAnalytics(timeRange),
              connector.fetchTrendingTopics(10)
            ]);
            analyticsResponse = analytics;
            trendsResponse = trends;
          }
          
          return { platform, analyticsResponse, trendsResponse };
        } catch (error) {
          console.warn(`Failed to fetch data from ${platform}:`, error);
          return { 
            platform, 
            analyticsResponse: { success: false, error: (error as Error).message },
            trendsResponse: { success: false, error: 'Failed' }
          };
        }
      });

      // Execute all platform calls in parallel with 8-second timeout
      const results = await Promise.allSettled(
        platformPromises.map(p => 
          Promise.race([
            p,
            new Promise<any>((_, reject) => 
              setTimeout(() => reject(new Error('Platform timeout')), 8000)
            )
          ])
        )
      );

      // Process results
      for (const settledResult of results) {
        try {
          if (settledResult.status === 'fulfilled') {
            const { platform, analyticsResponse, trendsResponse } = settledResult.value;
            
            if (platform === 'twitter') {
              console.log(`🐦 Aggregator processing Twitter data:`, {
                success: analyticsResponse.success,
                hasData: !!analyticsResponse.data,
                error: analyticsResponse.error
              });
            }
            
            if (analyticsResponse.success && analyticsResponse.data) {
              platformData[platform as SupportedPlatform] = analyticsResponse.data;
              const metrics = analyticsResponse.data.metrics;
              
              totalFollowers += metrics.followers || 0;
              totalLikes += metrics.likes || 0;
              totalShares += metrics.shares || 0;
              totalComments += metrics.comments || 0;
              totalViews += metrics.views || 0;
              
              if (metrics.engagement_rate !== undefined) {
                totalEngagementRates += metrics.engagement_rate;
                validPlatforms++;
              }
            }

            if (trendsResponse.success && trendsResponse.data) {
              allTrends.push(...trendsResponse.data);
            }
          } else {
            console.warn('Platform call failed:', settledResult.reason);
          }
        } catch (error) {
          console.warn('Error processing platform result:', error);
        }
      }

      const crossPlatformTrends = this.analyzeCrossPlatformTrends(allTrends);
      const insights = this.generateInsights(platformData, crossPlatformTrends);

      const aggregatedMetrics: AggregatedMetrics = {
        totalFollowers,
        totalLikes,
        totalShares,
        totalComments,
        totalViews,
        averageEngagementRate: validPlatforms > 0 ? totalEngagementRates / validPlatforms : 0,
        platformBreakdown: platformData,
        crossPlatformTrends,
        insights,
        lastUpdated: new Date()
      };

      this.setCached(cacheKey, aggregatedMetrics, 300000);
      return { success: true, data: aggregatedMetrics };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public async getTrendingInsights(timeRange = '7'): Promise<ApiResponse<TrendingInsights>> {
    try {
      const cacheKey = `insights-${timeRange}-${Array.from(this.connectors.keys()).join(',')}`;
      const cached = this.getCached(cacheKey, 600000);
      if (cached) {
        return { success: true, data: cached };
      }

      const allTrends: TrendData[] = [];
      const allPosts: Array<{
        platform: SupportedPlatform;
        content: string;
        engagementRate: number;
        timestamp: Date;
      }> = [];

      for (const [platform, connector] of this.connectors) {
        try {
          const trendsResponse = await connector.fetchTrendingTopics(25);
          if (trendsResponse.success && trendsResponse.data) {
            allTrends.push(...trendsResponse.data.map((trend: TrendData) => ({ ...trend, platform })));
          }

          const analyticsResponse = await connector.fetchAnalytics(timeRange);
          if (analyticsResponse.success && analyticsResponse.data?.posts) {
            allPosts.push(...analyticsResponse.data.posts.map(post => ({
              platform,
              content: post.content,
              engagementRate: post.engagement_rate,
              timestamp: post.timestamp
            })));
          }
        } catch (error) {
          console.warn(`Failed to fetch insights from ${platform}:`, error);
        }
      }

      const emergingTopics = this.identifyEmergingTopics(allTrends);
      const growingHashtags = this.extractGrowingHashtags(allTrends);
      const sentimentAnalysis = this.analyzeSentiment(allTrends);
      const bestPerformingContent = allPosts
        .sort((a, b) => b.engagementRate - a.engagementRate)
        .slice(0, 10);
      const recommendations = this.generateRecommendations(allTrends, allPosts);

      const insights: TrendingInsights = {
        emergingTopics,
        growingHashtags,
        sentimentAnalysis,
        bestPerformingContent,
        recommendations
      };

      this.setCached(cacheKey, insights, 600000);
      return { success: true, data: insights };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private analyzeCrossPlatformTrends(trends: TrendData[]): TrendData[] {
    const topicCounts: Record<string, TrendData> = {};

    trends.forEach(trend => {
      const normalizedTopic = trend.topic.toLowerCase().trim();
      if (topicCounts[normalizedTopic]) {
        topicCounts[normalizedTopic].mentions += trend.mentions;
        if (trend.hashtags) {
          topicCounts[normalizedTopic].hashtags = [
            ...(topicCounts[normalizedTopic].hashtags || []),
            ...trend.hashtags
          ];
        }
      } else {
        topicCounts[normalizedTopic] = { ...trend };
      }
    });

    return Object.values(topicCounts)
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 20);
  }

  private identifyEmergingTopics(trends: TrendData[]): TrendData[] {
    return trends
      .filter(trend => trend.growth_rate > 0.5 || trend.mentions > 1000)
      .sort((a, b) => b.growth_rate - a.growth_rate)
      .slice(0, 10);
  }

  private extractGrowingHashtags(trends: TrendData[]): string[] {
    const hashtags: Record<string, number> = {};
    
    trends.forEach(trend => {
      if (trend.hashtags) {
        trend.hashtags.forEach(tag => {
          hashtags[tag] = (hashtags[tag] || 0) + trend.mentions;
        });
      }
    });

    return Object.entries(hashtags)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15)
      .map(([tag]) => tag);
  }

  private analyzeSentiment(trends: TrendData[]): { positive: number; negative: number; neutral: number } {
    const counts = { positive: 0, negative: 0, neutral: 0 };
    
    trends.forEach(trend => {
      counts[trend.sentiment]++;
    });

    const total = trends.length || 1;
    return {
      positive: (counts.positive / total) * 100,
      negative: (counts.negative / total) * 100,
      neutral: (counts.neutral / total) * 100
    };
  }

  private generateInsights(
    platformData: Record<SupportedPlatform, AnalyticsData>,
    trends: TrendData[]
  ): string[] {
    const insights: string[] = [];

    const platforms = Object.keys(platformData) as SupportedPlatform[];
    if (platforms.length === 0) return insights;

    const bestPlatform = platforms.reduce((best, current) => {
      const bestMetrics = platformData[best]?.metrics;
      const currentMetrics = platformData[current]?.metrics;
      return (currentMetrics?.engagement_rate || 0) > (bestMetrics?.engagement_rate || 0) ? current : best;
    });

    insights.push(`${bestPlatform} shows the highest engagement rate among your platforms`);

    const topTrend = trends[0];
    if (topTrend) {
      insights.push(`"${topTrend.topic}" is currently trending with ${topTrend.mentions} mentions`);
    }

    const totalFollowers = platforms.reduce((sum, platform) => 
      sum + (platformData[platform]?.metrics?.followers || 0), 0
    );
    if (totalFollowers > 10000) {
      insights.push(`You have reached over ${Math.floor(totalFollowers / 1000)}K total followers across platforms`);
    }

    return insights;
  }

  private generateRecommendations(trends: TrendData[], posts: any[]): string[] {
    const recommendations: string[] = [];

    if (trends.length > 0) {
      const topTrend = trends[0];
      if (topTrend) {
        recommendations.push(`Consider creating content about "${topTrend.topic}" - it's currently trending`);
      }
    }

    if (posts.length > 0) {
      const bestPost = posts.sort((a, b) => b.engagementRate - a.engagementRate)[0];
      if (bestPost) {
        recommendations.push(`Your "${bestPost.content.substring(0, 50)}..." post performed well - consider similar content`);
      }
    }

    const hashtagTrends = trends.filter(t => t.hashtags && t.hashtags.length > 0);
    if (hashtagTrends.length > 0) {
      const topHashtag = hashtagTrends[0].hashtags?.[0];
      if (topHashtag) {
        recommendations.push(`Use hashtag #${topHashtag} in your next post for better reach`);
      }
    }

    return recommendations;
  }

  private getCached(key: string, maxAge: number): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp.getTime();
    if (age > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCached(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      ttl
    });

    setTimeout(() => {
      this.cache.delete(key);
    }, ttl);
  }
}