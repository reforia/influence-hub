import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { TokenManager } from '@/auth/tokenManager';
import { ConnectorFactory } from '@/connectors';
import { AnalyticsAggregator } from '@/analytics/aggregator';
import { SupportedPlatform, McpToolResult } from '@/types';
import { z } from 'zod';

const GetMetricsArgsSchema = z.object({
  platforms: z.array(z.enum(['facebook', 'youtube', 'twitter', 'reddit', 'tiktok', 'instagram', 'discord'])).optional(),
  timeRange: z.string().optional().default('7')
});

const GetTrendsArgsSchema = z.object({
  platforms: z.array(z.enum(['facebook', 'youtube', 'twitter', 'reddit', 'tiktok', 'instagram', 'discord'])).optional(),
  limit: z.number().optional().default(25)
});

const SearchContentArgsSchema = z.object({
  platform: z.enum(['twitter', 'reddit', 'youtube']),
  query: z.string(),
  limit: z.number().optional().default(50)
});

const GetUserStatsArgsSchema = z.object({
  platform: z.enum(['twitter', 'reddit', 'youtube']),
  username: z.string().optional()
});

class InfluenceHubMCPServer {
  private server: Server;
  private tokenManager: TokenManager;
  private connectorFactory: ConnectorFactory;
  private aggregator: AnalyticsAggregator;

  constructor() {
    this.server = new Server(
      {
        name: 'influence-hub',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.tokenManager = new TokenManager();
    this.connectorFactory = new ConnectorFactory();
    this.aggregator = new AnalyticsAggregator();

    this.setupConnectors();
    this.setupHandlers();
  }

  private setupConnectors(): void {
    const configuredPlatforms = this.tokenManager.listConfiguredPlatforms();
    
    configuredPlatforms.forEach(platform => {
      const credentials = this.tokenManager.getCredentials(platform);
      if (credentials) {
        try {
          const connector = this.connectorFactory.createConnector(platform, credentials);
          if (connector) {
            this.aggregator.addConnector(platform, connector);
          }
        } catch (error) {
          console.warn(`Failed to setup connector for ${platform}:`, error);
        }
      }
    });
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_social_metrics',
            description: 'Get aggregated social media metrics and analytics across all configured platforms',
            inputSchema: {
              type: 'object',
              properties: {
                platforms: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['facebook', 'youtube', 'twitter', 'reddit', 'tiktok', 'instagram', 'discord']
                  },
                  description: 'Specific platforms to get metrics from. If not provided, uses all configured platforms.'
                },
                timeRange: {
                  type: 'string',
                  description: 'Time range in days for analytics (default: 7)',
                  default: '7'
                }
              }
            }
          },
          {
            name: 'get_trending_topics',
            description: 'Get trending topics and hashtags across social media platforms',
            inputSchema: {
              type: 'object',
              properties: {
                platforms: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['facebook', 'youtube', 'twitter', 'reddit', 'tiktok', 'instagram', 'discord']
                  },
                  description: 'Specific platforms to get trends from'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of trends to return per platform (default: 25)',
                  default: 25
                }
              }
            }
          },
          {
            name: 'get_insights_summary',
            description: 'Get AI-powered insights and recommendations based on social media performance',
            inputSchema: {
              type: 'object',
              properties: {
                timeRange: {
                  type: 'string',
                  description: 'Time range in days for insights analysis (default: 7)',
                  default: '7'
                }
              }
            }
          },
          {
            name: 'search_content',
            description: 'Search for content on a specific platform',
            inputSchema: {
              type: 'object',
              properties: {
                platform: {
                  type: 'string',
                  enum: ['twitter', 'reddit', 'youtube'],
                  description: 'Platform to search on'
                },
                query: {
                  type: 'string',
                  description: 'Search query'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results (default: 50)',
                  default: 50
                }
              },
              required: ['platform', 'query']
            }
          },
          {
            name: 'get_user_stats',
            description: 'Get statistics for a specific user on a platform',
            inputSchema: {
              type: 'object',
              properties: {
                platform: {
                  type: 'string',
                  enum: ['twitter', 'reddit', 'youtube'],
                  description: 'Platform to get user stats from'
                },
                username: {
                  type: 'string',
                  description: 'Username to get stats for. If not provided, uses authenticated user.'
                }
              },
              required: ['platform']
            }
          },
          {
            name: 'list_configured_platforms',
            description: 'List all platforms that have been configured with API credentials',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'get_social_metrics':
            return await this.getSocialMetrics(request.params.arguments);
          
          case 'get_trending_topics':
            return await this.getTrendingTopics(request.params.arguments);
          
          case 'get_insights_summary':
            return await this.getInsightsSummary(request.params.arguments);
          
          case 'search_content':
            return await this.searchContent(request.params.arguments);
          
          case 'get_user_stats':
            return await this.getUserStats(request.params.arguments);
          
          case 'list_configured_platforms':
            return await this.listConfiguredPlatforms();
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Tool ${request.params.name} not found`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  private async getSocialMetrics(args: any): Promise<McpToolResult> {
    const parsed = GetMetricsArgsSchema.parse(args);
    const response = await this.aggregator.aggregateAllMetrics(parsed.timeRange);

    if (!response.success) {
      throw new McpError(ErrorCode.InternalError, response.error || 'Failed to fetch metrics');
    }

    const metrics = response.data!;
    const result = {
      summary: {
        totalFollowers: metrics.totalFollowers,
        totalEngagement: metrics.totalLikes + metrics.totalShares + metrics.totalComments,
        averageEngagementRate: Math.round(metrics.averageEngagementRate * 100) / 100,
        platformCount: Object.keys(metrics.platformBreakdown).length
      },
      platformBreakdown: metrics.platformBreakdown,
      topTrends: metrics.crossPlatformTrends.slice(0, 5),
      insights: metrics.insights,
      lastUpdated: metrics.lastUpdated.toISOString()
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  private async getTrendingTopics(args: any): Promise<McpToolResult> {
    const parsed = GetTrendsArgsSchema.parse(args);
    const response = await this.aggregator.getTrendingInsights('7');

    if (!response.success) {
      throw new McpError(ErrorCode.InternalError, response.error || 'Failed to fetch trends');
    }

    const insights = response.data!;
    const result = {
      emergingTopics: insights.emergingTopics.slice(0, parsed.limit),
      growingHashtags: insights.growingHashtags.slice(0, 15),
      sentimentAnalysis: insights.sentimentAnalysis,
      topContent: insights.bestPerformingContent.slice(0, 5)
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  private async getInsightsSummary(args: any): Promise<McpToolResult> {
    const timeRange = args?.timeRange || '7';
    const response = await this.aggregator.getTrendingInsights(timeRange);

    if (!response.success) {
      throw new McpError(ErrorCode.InternalError, response.error || 'Failed to fetch insights');
    }

    const insights = response.data!;
    const result = {
      recommendations: insights.recommendations,
      keyTrends: insights.emergingTopics.slice(0, 3),
      contentStrategy: {
        bestPerformingTopics: insights.emergingTopics.map(t => t.topic).slice(0, 5),
        recommendedHashtags: insights.growingHashtags.slice(0, 10),
        optimalSentiment: insights.sentimentAnalysis.positive > 60 ? 'positive' : 
                         insights.sentimentAnalysis.negative > 40 ? 'balanced' : 'positive'
      },
      performance: {
        topContent: insights.bestPerformingContent.slice(0, 3).map(c => ({
          platform: c.platform,
          snippet: c.content.substring(0, 100) + (c.content.length > 100 ? '...' : ''),
          engagementRate: Math.round(c.engagementRate * 100) / 100
        }))
      }
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  private async searchContent(args: any): Promise<McpToolResult> {
    const parsed = SearchContentArgsSchema.parse(args);
    
    const credentials = this.tokenManager.getCredentials(parsed.platform);
    if (!credentials) {
      throw new McpError(ErrorCode.InvalidParams, `Platform ${parsed.platform} is not configured`);
    }

    const connector = this.connectorFactory.createConnector(parsed.platform, credentials);
    if (!connector) {
      throw new McpError(ErrorCode.InternalError, `Connector for ${parsed.platform} not available`);
    }

    let response;
    if (parsed.platform === 'twitter' && 'searchTweets' in connector) {
      response = await (connector as any).searchTweets(parsed.query, parsed.limit);
    } else if (parsed.platform === 'reddit' && 'searchSubreddit' in connector) {
      const parts = parsed.query.split(' ');
      const subreddit = parts[0].replace('r/', '');
      const query = parts.slice(1).join(' ');
      response = await (connector as any).searchSubreddit(subreddit, query, parsed.limit);
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Search not implemented for ${parsed.platform}`);
    }

    if (!response.success) {
      throw new McpError(ErrorCode.InternalError, response.error || 'Search failed');
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2)
      }]
    };
  }

  private async getUserStats(args: any): Promise<McpToolResult> {
    const parsed = GetUserStatsArgsSchema.parse(args);
    
    const credentials = this.tokenManager.getCredentials(parsed.platform);
    if (!credentials) {
      throw new McpError(ErrorCode.InvalidParams, `Platform ${parsed.platform} is not configured`);
    }

    const connector = this.connectorFactory.createConnector(parsed.platform, credentials);
    if (!connector) {
      throw new McpError(ErrorCode.InternalError, `Connector for ${parsed.platform} not available`);
    }

    const response = await connector.fetchUserMetrics(parsed.username);

    if (!response.success) {
      throw new McpError(ErrorCode.InternalError, response.error || 'Failed to fetch user stats');
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2)
      }]
    };
  }

  private async listConfiguredPlatforms(): Promise<McpToolResult> {
    const platforms = this.tokenManager.listConfiguredPlatforms();
    const supportedPlatforms = this.connectorFactory.getSupportedPlatforms();
    
    const result = {
      configuredPlatforms: platforms,
      supportedPlatforms,
      status: platforms.map(platform => ({
        platform,
        configured: true,
        supported: supportedPlatforms.includes(platform),
        credentialsHash: this.tokenManager.hashCredentials(platform)
      }))
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  public async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

if (require.main === module) {
  const server = new InfluenceHubMCPServer();
  server.run().catch(console.error);
}

export { InfluenceHubMCPServer };