import dotenv from 'dotenv';
import express from 'express';
import { TokenManager } from './auth/tokenManager';
import { ConnectorFactory } from './connectors';
import { AnalyticsAggregator } from './analytics/aggregator';
import { SupportedPlatform } from './types';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const tokenManager = new TokenManager();
const connectorFactory = new ConnectorFactory();
const aggregator = new AnalyticsAggregator();

function setupConnectors() {
  const configuredPlatforms = tokenManager.listConfiguredPlatforms();
  
  configuredPlatforms.forEach(platform => {
    const credentials = tokenManager.getCredentials(platform);
    if (credentials) {
      try {
        const connector = connectorFactory.createConnector(platform, credentials);
        if (connector) {
          aggregator.addConnector(platform, connector);
          console.log(`✓ Connected to ${platform}`);
        }
      } catch (error) {
        console.warn(`⚠ Failed to setup connector for ${platform}:`, (error as Error).message);
      }
    }
  });
}

app.get('/', (req, res) => {
  res.json({
    name: 'Influence Hub',
    version: '1.0.0',
    description: 'Social media analytics and insights aggregator',
    endpoints: {
      '/status': 'Server status and connected platforms',
      '/metrics': 'Aggregated social media metrics',
      '/trends': 'Trending topics and insights',
      '/platforms': 'List of configured platforms'
    },
    mcp: {
      available: true,
      command: 'npm run mcp'
    }
  });
});

app.get('/status', (req, res) => {
  const configuredPlatforms = tokenManager.listConfiguredPlatforms();
  const supportedPlatforms = connectorFactory.getSupportedPlatforms();
  
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    platforms: {
      configured: configuredPlatforms.length,
      supported: supportedPlatforms.length,
      details: configuredPlatforms.map(platform => ({
        platform,
        hash: tokenManager.hashCredentials(platform),
        supported: supportedPlatforms.includes(platform)
      }))
    }
  });
});

app.get('/metrics', async (req, res) => {
  try {
    const timeRange = (req.query.timeRange as string) || '7';
    const response = await aggregator.aggregateAllMetrics(timeRange);
    
    if (response.success) {
      res.json(response.data);
    } else {
      res.status(500).json({ error: response.error });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/trends', async (req, res) => {
  try {
    const timeRange = (req.query.timeRange as string) || '7';
    const response = await aggregator.getTrendingInsights(timeRange);
    
    if (response.success) {
      res.json(response.data);
    } else {
      res.status(500).json({ error: response.error });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/platforms', (req, res) => {
  const configured = tokenManager.listConfiguredPlatforms();
  const available = connectorFactory.getAvailablePlatforms();
  const supported = connectorFactory.getSupportedPlatforms();
  
  res.json({
    configured,
    available,
    supported,
    status: available.map(platform => ({
      platform,
      configured: configured.includes(platform),
      supported: supported.includes(platform),
      ready: configured.includes(platform) && supported.includes(platform)
    }))
  });
});

app.post('/platforms/:platform/configure', (req, res) => {
  try {
    const platform = req.params.platform as SupportedPlatform;
    const credentials = req.body.credentials;

    if (!credentials) {
      return res.status(400).json({ error: 'Credentials required' });
    }

    if (!tokenManager.validateCredentials(platform, credentials)) {
      return res.status(400).json({ error: 'Invalid credentials format' });
    }

    tokenManager.setCredentials(platform, credentials);
    
    const connector = connectorFactory.createConnector(platform, credentials);
    if (connector) {
      aggregator.addConnector(platform, connector);
    }

    res.json({ 
      success: true, 
      message: `${platform} configured successfully`,
      hash: tokenManager.hashCredentials(platform)
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/platforms/:platform', (req, res) => {
  try {
    const platform = req.params.platform as SupportedPlatform;
    
    tokenManager.removeCredentials(platform);
    aggregator.removeConnector(platform);
    
    res.json({ 
      success: true, 
      message: `${platform} removed successfully` 
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

setupConnectors();

app.listen(port, () => {
  console.log(`
🚀 Influence Hub Server Running

Server: http://localhost:${port}
MCP Server: npm run mcp

Configured Platforms: ${tokenManager.listConfiguredPlatforms().join(', ') || 'None'}

Available Endpoints:
  GET  /              - API information
  GET  /status        - Server status
  GET  /metrics       - Social media metrics
  GET  /trends        - Trending insights
  GET  /platforms     - Platform status
  POST /platforms/:platform/configure - Configure platform
  DEL  /platforms/:platform - Remove platform

📖 See README.md for setup instructions
  `);
});

export { app, tokenManager, aggregator, connectorFactory };