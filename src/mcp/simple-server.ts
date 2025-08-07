import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

import { TokenManager } from '../auth/tokenManager';
import { ConnectorFactory } from '../connectors';
import { AnalyticsAggregator } from '../analytics/aggregator';

class InfluenceHubMCP {
  private server: Server;
  private tokenManager: TokenManager;
  private connectorFactory: ConnectorFactory;
  private aggregator: AnalyticsAggregator;

  constructor() {
    this.server = new Server({
      name: 'influence-hub',
      version: '1.0.0'
    });

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
            console.log(`✓ MCP: Connected to ${platform}`);
          }
        } catch (error) {
          console.warn(`⚠ MCP: Failed to setup ${platform}:`, (error as Error).message);
        }
      }
    });
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_youtube_videos',
            description: 'Get your uploaded YouTube videos with analytics',
            inputSchema: {
              type: 'object',
              properties: {
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of videos to return (default: 10)',
                  default: 10
                },
                timeRange: {
                  type: 'string', 
                  description: 'Time range in days for analytics (default: 30)',
                  default: '30'
                }
              }
            }
          },
          {
            name: 'get_social_metrics',
            description: 'Get aggregated metrics across all connected social platforms',
            inputSchema: {
              type: 'object',
              properties: {
                timeRange: {
                  type: 'string',
                  description: 'Time range in days (default: 7)',
                  default: '7'
                }
              }
            }
          },
          {
            name: 'get_trending_topics',
            description: 'Get trending topics from your connected platforms',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Number of trends to return (default: 20)',
                  default: 20
                }
              }
            }
          },
          {
            name: 'get_platform_status',
            description: 'Check which platforms are connected and working',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_youtube_videos':
          return await this.getYouTubeVideos(request.params.arguments);
        
        case 'get_social_metrics':
          return await this.getSocialMetrics(request.params.arguments);
        
        case 'get_trending_topics':
          return await this.getTrendingTopics(request.params.arguments);
        
        case 'get_platform_status':
          return await this.getPlatformStatus();
        
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  private async getYouTubeVideos(args: any) {
    try {
      const maxResults = args?.maxResults || 10;
      const timeRange = args?.timeRange || '30';

      // Check if YouTube is connected
      if (!this.tokenManager.hasCredentials('youtube')) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'YouTube not configured',
              message: 'Please add your YouTube API key to connect'
            }, null, 2)
          }]
        };
      }

      // Get YouTube analytics
      const response = await this.aggregator.aggregateAllMetrics(timeRange);
      
      if (!response.success) {
        return {
          content: [{
            type: 'text', 
            text: JSON.stringify({
              error: 'Failed to fetch YouTube data',
              message: response.error
            }, null, 2)
          }]
        };
      }

      const youtubeData = response.data?.platformBreakdown?.youtube;
      
      const result = {
        status: 'success',
        platform: 'youtube',
        metrics: youtubeData?.metrics || {},
        videos: youtubeData?.posts?.slice(0, maxResults) || [],
        summary: {
          totalVideos: youtubeData?.posts?.length || 0,
          followers: youtubeData?.metrics?.followers || 0,
          totalViews: youtubeData?.metrics?.views || 0,
          timeRange: `${timeRange} days`
        }
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'YouTube video fetch failed',
            message: (error as Error).message
          }, null, 2)
        }]
      };
    }
  }

  private async getSocialMetrics(args: any) {
    try {
      const timeRange = args?.timeRange || '7';
      const response = await this.aggregator.aggregateAllMetrics(timeRange);
      
      if (!response.success) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: response.error }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: (error as Error).message }, null, 2)
        }]
      };
    }
  }

  private async getTrendingTopics(args: any) {
    try {
      const limit = args?.limit || 20;
      const response = await this.aggregator.getTrendingInsights();
      
      if (!response.success) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: response.error }, null, 2)
          }]
        };
      }

      const result = {
        emergingTopics: response.data?.emergingTopics?.slice(0, limit) || [],
        growingHashtags: response.data?.growingHashtags?.slice(0, 15) || [],
        recommendations: response.data?.recommendations || []
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: (error as Error).message }, null, 2)
        }]
      };
    }
  }

  private async getPlatformStatus() {
    try {
      const configured = this.tokenManager.listConfiguredPlatforms();
      const available = this.connectorFactory.getAvailablePlatforms();
      const supported = this.connectorFactory.getSupportedPlatforms();
      
      const result = {
        status: 'success',
        platforms: {
          configured,
          available,
          supported
        },
        details: available.map(platform => ({
          platform,
          configured: configured.includes(platform),
          supported: supported.includes(platform),
          ready: configured.includes(platform) && supported.includes(platform)
        }))
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: (error as Error).message }, null, 2)
        }]
      };
    }
  }

  public async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('🤖 Influence Hub MCP Server running');
  }
}

if (require.main === module) {
  const server = new InfluenceHubMCP();
  server.run().catch(console.error);
}

export { InfluenceHubMCP };