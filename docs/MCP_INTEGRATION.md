# MCP Server Integration Guide

Influence Hub provides a Model Context Protocol (MCP) server that allows AI models to access social media analytics and insights.

## What is MCP?

The Model Context Protocol (MCP) is an open protocol that enables AI assistants to securely connect to external data sources and tools. It provides a standardized way for AI models to interact with various services.

## Available Tools

The Influence Hub MCP server provides these tools:

### `get_social_metrics`
Get aggregated social media metrics across all configured platforms.

**Parameters:**
- `platforms` (optional): Array of platforms to include
- `timeRange` (optional): Time range in days (default: 7)

**Returns:** Aggregated metrics including followers, engagement, and platform breakdown.

### `get_trending_topics`
Get trending topics and hashtags across platforms.

**Parameters:**
- `platforms` (optional): Array of platforms to include
- `limit` (optional): Maximum trends per platform (default: 25)

**Returns:** Trending topics with sentiment analysis and growth metrics.

### `get_insights_summary`
Get AI-powered insights and content recommendations.

**Parameters:**
- `timeRange` (optional): Time range for analysis (default: 7)

**Returns:** Personalized recommendations and performance insights.

### `search_content`
Search for content on a specific platform.

**Parameters:**
- `platform`: Platform to search (twitter, reddit, youtube)
- `query`: Search query
- `limit` (optional): Maximum results (default: 50)

**Returns:** Search results with engagement metrics.

### `get_user_stats`
Get statistics for a specific user.

**Parameters:**
- `platform`: Platform to query
- `username` (optional): Username to analyze (defaults to authenticated user)

**Returns:** User statistics and metrics.

### `list_configured_platforms`
List all configured platforms and their status.

**Returns:** Platform configuration status and availability.

## Setup Instructions

### 1. Configure Claude Desktop

Add Influence Hub to your Claude Desktop configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "influence-hub": {
      "command": "node",
      "args": ["/path/to/influence-hub/dist/mcp/server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 2. Using Development Mode

For development, you can run the MCP server directly:

```bash
# Build the project
npm run build

# Run MCP server
npm run mcp
```

### 3. Environment Variables

Ensure all required environment variables are set (see API_SETUP.md):

```bash
# Copy example environment file
cp .env.example .env

# Edit with your API credentials
nano .env
```

### 4. Test the Integration

Start Claude Desktop and test the integration:

```
Can you get my social media metrics for the last 7 days?
```

```
What are the trending topics on my social platforms?
```

```
Give me insights and recommendations for my content strategy.
```

## Usage Examples

### Basic Analytics Query
```
Get my social media performance metrics for the past week.
```

**Response:** Aggregated followers, engagement rates, top-performing content, and platform breakdown.

### Trending Analysis
```
What topics are trending across my social media platforms? 
Show me the top 10 with sentiment analysis.
```

**Response:** Trending topics ranked by mentions, hashtag analysis, and sentiment breakdown.

### Content Strategy
```
Based on my recent social media performance, what content should I create next?
```

**Response:** AI-generated recommendations based on trending topics, engagement patterns, and audience preferences.

### Platform-Specific Search
```
Search for mentions of "AI automation" on Twitter and show engagement metrics.
```

**Response:** Search results with likes, retweets, comments, and engagement analysis.

### Competitive Analysis
```
Get user statistics for @competitor_handle on Twitter and compare with my metrics.
```

**Response:** Comparative analysis of follower growth, engagement rates, and content performance.

## Advanced Configuration

### Custom Rate Limits

You can customize rate limits in your configuration:

```typescript
// src/connectors/custom-limits.ts
export const customRateLimits = {
  twitter: { requestsPerHour: 200, requestsPerDay: 400 },
  youtube: { requestsPerHour: 5000, requestsPerDay: 500000 }
};
```

### Platform Priority

Set platform priority for aggregated queries:

```typescript
// In your MCP server configuration
const platformPriority = ['twitter', 'youtube', 'reddit', 'facebook'];
```

### Caching Configuration

Adjust caching settings for better performance:

```typescript
// Cache settings (in milliseconds)
const cacheConfig = {
  metrics: 300000,      // 5 minutes
  trends: 600000,       // 10 minutes  
  insights: 900000      // 15 minutes
};
```

## Troubleshooting

### Common Issues

1. **"Platform not configured" error**
   - Ensure API credentials are set in environment variables
   - Check that credentials are valid and not expired

2. **Rate limit exceeded**
   - Reduce query frequency
   - Check platform-specific rate limits
   - Consider upgrading API tiers if available

3. **No data returned**
   - Verify platform connections with `/status` endpoint
   - Check that accounts have recent activity
   - Ensure correct time range parameters

### Debug Mode

Enable debug logging:

```bash
DEBUG=influence-hub:* npm run mcp
```

### Health Check

Test MCP server health:

```bash
# Check if server is responding
curl -X POST http://localhost:3001/health

# Validate tool registration
curl -X POST http://localhost:3001/tools
```

## Integration with Other Tools

### Zapier Integration
Connect Influence Hub to Zapier for automated workflows:

1. Set up webhook triggers
2. Use API endpoints for data extraction
3. Create automated reports and alerts

### Analytics Dashboards
Export data to visualization tools:

- Grafana for real-time dashboards
- Tableau for advanced analytics
- Google Sheets for simple tracking

### Custom Applications
Use the REST API for custom integrations:

```javascript
// Fetch metrics in your application
const metrics = await fetch('http://localhost:3000/metrics?timeRange=30')
  .then(res => res.json());

// Use in your custom dashboard
renderMetricsDashboard(metrics);
```