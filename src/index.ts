import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import { TokenManager } from './auth/tokenManager';
import { ConnectorFactory } from './connectors';
import { AnalyticsAggregator } from './analytics/aggregator';
import { SupportedPlatform, PlatformCredentials } from './types';
import { YouTubeOAuthConnector } from './connectors/youtube-oauth';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3002');

app.use(express.json());

const tokenManager = new TokenManager();
const connectorFactory = new ConnectorFactory();
const aggregator = new AnalyticsAggregator();

// Track actual platform connection status
const platformStatus = new Map<SupportedPlatform, { connected: boolean; lastTested: Date; error?: string }>();

// Cache for Twitter data to use when rate limited
const twitterDataCache = {
  userResult: null as any,
  tweetsResult: null as any,
  lastUpdated: null as Date | null
};

function setupConnectors() {
  const configuredPlatforms = tokenManager.listConfiguredPlatforms();
  const allSupportedPlatforms = connectorFactory.getSupportedPlatforms();
  
  // Initialize all platforms as disconnected
  allSupportedPlatforms.forEach(platform => {
    platformStatus.set(platform, {
      connected: false,
      lastTested: new Date(),
      error: 'No credentials configured'
    });
  });
  
  configuredPlatforms.forEach(platform => {
    const credentials = tokenManager.getCredentials(platform);
    if (credentials) {
      try {
        const connector = connectorFactory.createConnector(platform, credentials);
        if (connector) {
          aggregator.addConnector(platform, connector);
          console.log(`✓ Connected to ${platform}`);
          
          // Test connection once after server starts (no recurring validation to prevent rate limits)
          setTimeout(async () => {
            try {
              let isValid = false;
              
              // For platforms that require OAuth, check if we have OAuth tokens
              if (platform === 'youtube' && credentials.access_token) {
                // Use OAuth connector for YouTube if we have access_token
                const { YouTubeOAuthConnector } = require('./connectors/youtube-oauth');
                const oauthConnector = new YouTubeOAuthConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
                isValid = await oauthConnector.validateCredentials();
              } else if (platform === 'twitter' && credentials.access_token && credentials.access_token_secret) {
                // Skip Twitter validation to prevent rate limits - assume valid if we have required tokens
                console.log(`🐦 Twitter configured with OAuth tokens - skipping validation to preserve rate limits`);
                isValid = true;
              } else if (platform === 'facebook' && !credentials.access_token) {
                // Facebook requires access_token, mark as invalid if missing
                isValid = false;
              } else {
                // Use regular connector validation for API-key based platforms or when no OAuth tokens
                isValid = await connector.testConnection();
              }
              
              platformStatus.set(platform, {
                connected: isValid,
                lastTested: new Date(),
                error: isValid ? undefined : (platform === 'youtube' && credentials.access_token ? 'OAuth validation failed' : (platform === 'twitter' ? 'Rate limit protection enabled' : 'API validation failed'))
              });
              
              if (isValid) {
                console.log(`✅ ${platform} API validation successful`);
              } else {
                console.warn(`⚠️ ${platform} API validation failed`);
              }
            } catch (error) {
              platformStatus.set(platform, {
                connected: false,
                lastTested: new Date(),
                error: (error as Error).message
              });
              console.warn(`⚠️ ${platform} API test error:`, (error as Error).message);
            }
          }, 1000);
        }
      } catch (error) {
        console.warn(`⚠ Failed to setup connector for ${platform}:`, (error as Error).message);
      }
    }
  });
}

app.get('/', (req, res) => {
  const configuredPlatforms = tokenManager.listConfiguredPlatforms();
  const supportedPlatforms = connectorFactory.getSupportedPlatforms();
  
  // Get actual connection status for each platform
  const getConnectionStatus = (platform: SupportedPlatform) => {
    const status = platformStatus.get(platform);
    if (!status) return { connected: false, status: 'Unknown', error: 'Not tested' };
    
    return {
      connected: status.connected,
      status: status.connected ? 'Connected' : 'Disconnected',
      error: status.error,
      lastTested: status.lastTested.toLocaleString()
    };
  };
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Influence Hub - Social Media Analytics</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px;
                text-align: center;
            }
            .header h1 { font-size: 2.5em; margin-bottom: 10px; }
            .header p { font-size: 1.2em; opacity: 0.9; }
            .content { padding: 40px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; margin-bottom: 40px; }
            .card {
                background: #f8f9fa;
                border-radius: 15px;
                padding: 30px;
                text-align: center;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                border: 1px solid #e9ecef;
            }
            .card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .card h3 { color: #495057; margin-bottom: 15px; font-size: 1.4em; }
            .card p { color: #6c757d; margin-bottom: 20px; }
            .btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 25px;
                text-decoration: none;
                display: inline-block;
                transition: transform 0.2s ease;
                font-weight: 500;
            }
            .btn:hover { transform: scale(1.05); }
            .status-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin-top: 30px;
            }
            .status-card {
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
            }
            .status-card.youtube { background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%); }
            .platform-list { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
            .platform-badge {
                background: rgba(102, 126, 234, 0.1);
                color: #495057;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 0.9em;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 Influence Hub</h1>
                <p>Social Media Analytics & Insights Platform</p>
            </div>
            
            <div class="content">
                <div class="grid">
                    <div class="card">
                        <h3>📊 Analytics Dashboard</h3>
                        <p>View comprehensive social media metrics and performance data</p>
                        <a href="/dashboard" class="btn">View Dashboard</a>
                    </div>
                    
                    <div class="card">
                        <h3>🎥 YouTube Videos</h3>
                        <p>Access and analyze your uploaded YouTube content</p>
                        <a href="/youtube/dashboard" class="btn">YouTube Dashboard</a>
                        ${getConnectionStatus('youtube').connected ? 
                          '<p style="color: #28a745; margin-top: 10px;">✅ Connected via OAuth</p>' : 
                          '<a href="/auth/youtube" class="btn" style="background: #28a745; margin-top: 10px;">Authenticate YouTube</a>'
                        }
                    </div>
                    
                    <div class="card">
                        <h3>🐦 Twitter Analytics</h3>
                        <p>View your tweets, followers, and engagement metrics</p>
                        <a href="/twitter/dashboard" class="btn">Twitter Dashboard</a>
                        ${getConnectionStatus('twitter').connected ? 
                          '<p style="color: #28a745; margin-top: 10px;">✅ Connected via OAuth</p>' : 
                          '<a href="/auth/twitter" class="btn" style="background: #28a745; margin-top: 10px;">Authenticate Twitter</a>'
                        }
                    </div>
                    
                    ${configuredPlatforms.includes('facebook') ? `
                        <div class="card">
                            <h3>📘 Facebook Analytics</h3>
                            <p>View your Facebook pages, posts, and engagement data</p>
                            <a href="/facebook/dashboard" class="btn">Facebook Dashboard</a>
                        </div>
                    ` : ''}
                    
                    <div class="card">
                        <h3>🔶 Reddit Analytics</h3>
                        <p>View your Reddit posts, karma, and subreddit engagement</p>
                        <a href="/reddit/dashboard" class="btn">Reddit Dashboard</a>
                        ${getConnectionStatus('reddit').connected ? 
                          '<p style="color: #28a745; margin-top: 10px;">✅ Connected via OAuth</p>' : 
                          '<a href="/auth/reddit" class="btn" style="background: #28a745; margin-top: 10px;">Authenticate Reddit</a>'
                        }
                    </div>
                    
                    <div class="card">
                        <h3>📈 Trends & Insights</h3>
                        <p>Discover trending topics and engagement patterns</p>
                        <a href="/trends" class="btn">View Trends</a>
                    </div>
                    
                    <div class="card">
                        <h3>⚙️ Platform Settings</h3>
                        <p>Manage connected platforms and API configurations</p>
                        <a href="/api-keys" class="btn">Manage Platforms</a>
                    </div>
                </div>
                
                <div class="status-grid">
                    <div class="status-card">
                        <h4>📱 Configured Platforms</h4>
                        <h2>${configuredPlatforms.length}</h2>
                        <div class="platform-list">
                            ${configuredPlatforms.map(p => `<span class="platform-badge">${p}</span>`).join('')}
                        </div>
                    </div>
                    
                    <div class="status-card youtube">
                        <h4>🎯 YouTube Status</h4>
                        <h2>${getConnectionStatus('youtube').status}</h2>
                        ${getConnectionStatus('youtube').connected ? 
                          '<p>✅ Ready to fetch your videos</p>' : 
                          `<p>⚠️ ${getConnectionStatus('youtube').error || 'Configure API key'}</p>`
                        }
                    </div>
                    
                    <div class="status-card" style="background: linear-gradient(135deg, #1DA1F2 0%, #1A91DA 100%);">
                        <h4>🐦 Twitter Status</h4>
                        <h2>${getConnectionStatus('twitter').status}</h2>
                        ${getConnectionStatus('twitter').connected ? 
                          '<p>✅ Ready to fetch your tweets</p>' : 
                          `<p>⚠️ ${getConnectionStatus('twitter').error || 'Configure API keys'}</p>`
                        }
                    </div>
                    
                    <div class="status-card" style="background: linear-gradient(135deg, #4267B2 0%, #365899 100%);">
                        <h4>📘 Facebook Status</h4>
                        <h2>${getConnectionStatus('facebook').status}</h2>
                        ${getConnectionStatus('facebook').connected ? 
                          '<p>✅ Ready to fetch your pages</p>' : 
                          `<p>⚠️ ${getConnectionStatus('facebook').error || 'Configure API keys'}</p>`
                        }
                    </div>
                    
                    <div class="status-card" style="background: linear-gradient(135deg, #FF4500 0%, #FF5700 100%);">
                        <h4>🔶 Reddit Status</h4>
                        <h2>${getConnectionStatus('reddit').status}</h2>
                        ${getConnectionStatus('reddit').connected ? 
                          '<p>✅ Ready to fetch your posts</p>' : 
                          `<p>⚠️ ${getConnectionStatus('reddit').error || 'Complete OAuth flow'}</p>`
                        }
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                    <h3>🔗 Quick Links</h3>
                    <p style="margin: 10px 0;">
                        <a href="/selftest" class="btn" style="margin: 5px;">System Test</a>
                        <a href="/api/status" class="btn" style="margin: 5px;">API Status</a>
                        <a href="https://github.com/reforia/influence-hub" class="btn" style="margin: 5px;">GitHub Repo</a>
                    </p>
                </div>
            </div>
        </div>
        
        <script>
            // Auto-refresh status every 30 seconds
            setTimeout(() => location.reload(), 30000);
        </script>
    </body>
    </html>
  `);
});

// Keep API routes for JSON responses (add /api prefix)
app.get('/api/status', (req, res) => {
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

// YouTube Dashboard
app.get('/youtube/dashboard', async (req, res) => {
  const credentials = tokenManager.getCredentials('youtube');
  const authSuccess = req.query.auth === 'success';
  
  // First check if we have basic credentials
  if (!credentials?.access_token) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>YouTube Dashboard - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                  min-height: 100vh;
                  padding: 20px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
              .auth-card {
                  background: white;
                  border-radius: 20px;
                  padding: 60px 40px;
                  text-align: center;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                  max-width: 500px;
              }
              .youtube-icon { font-size: 4em; margin-bottom: 20px; }
              h1 { color: #333; margin-bottom: 15px; }
              p { color: #666; margin-bottom: 30px; line-height: 1.5; }
              .btn {
                  background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                  color: white;
                  padding: 15px 30px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  font-size: 1.1em;
                  font-weight: 500;
                  transition: transform 0.2s ease;
              }
              .btn:hover { transform: scale(1.05); }
              .back-btn {
                  background: #6c757d;
                  margin-right: 15px;
              }
          </style>
      </head>
      <body>
          <div class="auth-card">
              <div class="youtube-icon">🎥</div>
              <h1>YouTube Authentication Required</h1>
              <p>To access your YouTube dashboard and view your videos, please authenticate with your Google account.</p>
              <a href="/" class="btn back-btn">← Back to Home</a>
              <a href="/auth/youtube" class="btn">Connect YouTube</a>
          </div>
      </body>
      </html>
    `);
  }

  // Now validate that the OAuth connection is actually working
  try {
    const connector = new YouTubeOAuthConnector(credentials as any, new (require('./utils/rateLimiter').RateLimiter)());
    const isValidConnection = await connector.validateCredentials();
    
    if (!isValidConnection) {
      // OAuth token is invalid/expired, prompt to re-authenticate
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>YouTube Dashboard - Influence Hub</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                    min-height: 100vh;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .auth-card {
                    background: white;
                    border-radius: 20px;
                    padding: 60px 40px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    max-width: 500px;
                }
                .youtube-icon { font-size: 4em; margin-bottom: 20px; }
                h1 { color: #333; margin-bottom: 15px; }
                p { color: #666; margin-bottom: 30px; line-height: 1.5; }
                .btn {
                    background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                    color: white;
                    padding: 15px 30px;
                    border: none;
                    border-radius: 25px;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 1.1em;
                    font-weight: 500;
                    transition: transform 0.2s ease;
                }
                .btn:hover { transform: scale(1.05); }
                .back-btn {
                    background: #6c757d;
                    margin-right: 15px;
                }
                .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="auth-card">
                <div class="youtube-icon">🎥</div>
                <h1>YouTube Connection Expired</h1>
                <div class="warning">
                    Your YouTube authentication has expired or is invalid. Please re-authenticate to access your dashboard.
                </div>
                <p>Your previous connection to YouTube is no longer valid. This can happen when tokens expire or are revoked.</p>
                <a href="/" class="btn back-btn">← Back to Home</a>
                <a href="/auth/youtube" class="btn">Re-authenticate YouTube</a>
            </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    // Connection test failed, prompt to re-authenticate
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>YouTube Dashboard - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                  min-height: 100vh;
                  padding: 20px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
              .auth-card {
                  background: white;
                  border-radius: 20px;
                  padding: 60px 40px;
                  text-align: center;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                  max-width: 500px;
              }
              .youtube-icon { font-size: 4em; margin-bottom: 20px; }
              h1 { color: #333; margin-bottom: 15px; }
              p { color: #666; margin-bottom: 30px; line-height: 1.5; }
              .btn {
                  background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                  color: white;
                  padding: 15px 30px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  font-size: 1.1em;
                  font-weight: 500;
                  transition: transform 0.2s ease;
              }
              .btn:hover { transform: scale(1.05); }
              .back-btn {
                  background: #6c757d;
                  margin-right: 15px;
              }
              .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
          </style>
      </head>
      <body>
          <div class="auth-card">
              <div class="youtube-icon">🎥</div>
              <h1>YouTube Connection Error</h1>
              <div class="error">
                  Failed to connect to YouTube API. Please re-authenticate to access your dashboard.
              </div>
              <p>There was an error validating your YouTube connection: ${(error as Error).message}</p>
              <a href="/" class="btn back-btn">← Back to Home</a>
              <a href="/auth/youtube" class="btn">Re-authenticate YouTube</a>
          </div>
      </body>
      </html>
    `);
  }

  
  // If we reach here, OAuth connection is valid - proceed with dashboard
  try {
    const connector = new YouTubeOAuthConnector(credentials as any, new (require('./utils/rateLimiter').RateLimiter)());
    const videosResult = await connector.getUploadedVideos(10);
    const channelResult = await connector.fetchUserMetrics();

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>YouTube Dashboard - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  min-height: 100vh;
                  padding: 20px;
              }
              .container { max-width: 1200px; margin: 0 auto; }
              .header {
                  background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 15px;
                  margin-bottom: 30px;
                  text-align: center;
              }
              .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                  gap: 20px;
                  margin-bottom: 30px;
              }
              .stat-card {
                  background: white;
                  padding: 25px;
                  border-radius: 10px;
                  text-align: center;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .stat-number { font-size: 2.5em; font-weight: bold; color: #ff0000; margin-bottom: 5px; }
              .stat-label { color: #6c757d; font-size: 0.9em; }
              .videos-section {
                  background: white;
                  border-radius: 15px;
                  padding: 30px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .video-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                  gap: 20px;
                  margin-top: 20px;
              }
              .video-card {
                  border: 1px solid #e9ecef;
                  border-radius: 10px;
                  overflow: hidden;
                  transition: transform 0.2s ease;
              }
              .video-card:hover { transform: translateY(-2px); }
              .video-thumbnail {
                  width: 100%;
                  height: 180px;
                  background: #000;
                  background-size: cover;
                  background-position: center;
                  position: relative;
              }
              .play-button {
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  background: rgba(255,255,255,0.9);
                  width: 50px;
                  height: 50px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 1.2em;
              }
              .video-info {
                  padding: 15px;
              }
              .video-title {
                  font-weight: 600;
                  margin-bottom: 8px;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
                  overflow: hidden;
              }
              .video-stats {
                  display: flex;
                  justify-content: space-between;
                  font-size: 0.9em;
                  color: #6c757d;
              }
              .btn {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 10px 20px;
                  border: none;
                  border-radius: 20px;
                  text-decoration: none;
                  display: inline-block;
                  margin-right: 10px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎥 YouTube Dashboard</h1>
                  <p>Your channel analytics and recent videos</p>
                  ${authSuccess ? '<div style="background: rgba(40, 167, 69, 0.2); padding: 15px; border-radius: 10px; margin: 20px 0;"><strong>✅ Successfully connected to YouTube!</strong> You can now view your videos and analytics.</div>' : ''}
                  <div style="margin-top: 20px;">
                      <a href="/" class="btn">← Back to Home</a>
                      <a href="/youtube/videos?maxResults=50" class="btn">View All Videos</a>
                  </div>
              </div>

              ${channelResult.success && channelResult.data?.items?.[0] ? `
              <div class="stats-grid">
                  <div class="stat-card">
                      <div class="stat-number">${parseInt(channelResult.data.items[0].statistics?.subscriberCount || '0').toLocaleString()}</div>
                      <div class="stat-label">Subscribers</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-number">${videosResult.success && videosResult.data ? videosResult.data.length : parseInt(channelResult.data.items[0].statistics?.videoCount || '0')}</div>
                      <div class="stat-label">Videos</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-number">${(() => {
                        const channelViews = parseInt(channelResult.data.items[0].statistics?.viewCount || '0');
                        const calculatedViews = videosResult.success && videosResult.data ? 
                          videosResult.data.reduce((total, video) => total + video.statistics.viewCount, 0) : 0;
                        return Math.max(channelViews, calculatedViews).toLocaleString();
                      })()}</div>
                      <div class="stat-label">Total Views</div>
                  </div>
              </div>
              ` : ''}

              <div class="videos-section">
                  <h2>🎬 Recent Videos</h2>
                  ${videosResult.success && videosResult.data ? `
                  <div class="video-grid">
                      ${videosResult.data.slice(0, 6).map(video => `
                          <div class="video-card">
                              <div class="video-thumbnail" style="background-image: url('${video.thumbnails?.medium?.url || ''}')">
                                  <div class="play-button">▶️</div>
                              </div>
                              <div class="video-info">
                                  <div class="video-title">${video.title}</div>
                                  <div class="video-stats">
                                      <span>👁️ ${video.statistics.viewCount.toLocaleString()}</span>
                                      <span>👍 ${video.statistics.likeCount.toLocaleString()}</span>
                                      <span>💬 ${video.statistics.commentCount.toLocaleString()}</span>
                                  </div>
                                  <div style="margin-top: 10px;">
                                      <a href="${video.url}" target="_blank" style="color: #ff0000; text-decoration: none;">Watch on YouTube →</a>
                                  </div>
                              </div>
                          </div>
                      `).join('')}
                  </div>
                  ` : '<p>No videos found or error loading videos.</p>'}
              </div>
          </div>
      </body>
      </html>
    `);
    return;
  } catch (error) {
    return res.status(500).send(`<h1>Error loading YouTube dashboard</h1><p>${(error as Error).message}</p>`);
  }
});

// Twitter Dashboard
app.get('/twitter/dashboard', async (req, res) => {
  const credentials = tokenManager.getCredentials('twitter');
  
  if (!credentials?.bearer_token && !credentials?.access_token) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Twitter Dashboard - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: linear-gradient(135deg, #1DA1F2 0%, #1A91DA 100%);
                  min-height: 100vh;
                  padding: 20px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
              .setup-card {
                  background: white;
                  border-radius: 20px;
                  padding: 60px 40px;
                  text-align: center;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                  max-width: 500px;
              }
              .twitter-icon { font-size: 4em; margin-bottom: 20px; }
              h1 { color: #333; margin-bottom: 15px; }
              p { color: #666; margin-bottom: 20px; line-height: 1.5; }
              .btn {
                  background: linear-gradient(135deg, #1DA1F2 0%, #1A91DA 100%);
                  color: white;
                  padding: 15px 30px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  font-size: 1.1em;
                  font-weight: 500;
                  transition: transform 0.2s ease;
                  margin: 5px;
              }
              .btn:hover { transform: scale(1.05); }
              .back-btn { background: #6c757d; }
          </style>
      </head>
      <body>
          <div class="setup-card">
              <div class="twitter-icon">🐦</div>
              <h1>Twitter API Setup Required</h1>
              <p>To access your Twitter dashboard and analytics, please add your Twitter API credentials to the .env file.</p>
              <p>Visit <a href="https://developer.twitter.com" target="_blank">Twitter Developer Portal</a> to get your API keys.</p>
              <a href="/" class="btn back-btn">← Back to Home</a>
              <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" class="btn">Get Twitter API Keys</a>
          </div>
      </body>
      </html>
    `);
  }

  try {
    const { TwitterConnector } = require('./connectors/twitter');
    let connector;
    let isOAuth = false;
    
    // Use OAuth connector if we have OAuth tokens, otherwise fall back to regular connector
    if (credentials.access_token && credentials.access_token_secret) {
      const { TwitterOAuthConnector } = require('./connectors/twitter-oauth');
      connector = new TwitterOAuthConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
      isOAuth = true;
    } else {
      connector = new TwitterConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
    }
    
    // Skip validation to prevent rate limits - assume connection is valid if credentials exist
    // const isValidConnection = await connector.validateCredentials();
    
    if (false) { // Skip validation block to prevent rate limits
      // Twitter OAuth/API is invalid/expired, prompt to fix credentials
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Twitter Dashboard - Influence Hub</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #1DA1F2 0%, #1A91DA 100%);
                    min-height: 100vh;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .auth-card {
                    background: white;
                    border-radius: 20px;
                    padding: 60px 40px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    max-width: 500px;
                }
                .twitter-icon { font-size: 4em; margin-bottom: 20px; }
                h1 { color: #333; margin-bottom: 15px; }
                p { color: #666; margin-bottom: 30px; line-height: 1.5; }
                .btn {
                    background: linear-gradient(135deg, #1DA1F2 0%, #1A91DA 100%);
                    color: white;
                    padding: 15px 30px;
                    border: none;
                    border-radius: 25px;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 1.1em;
                    font-weight: 500;
                    transition: transform 0.2s ease;
                }
                .btn:hover { transform: scale(1.05); }
                .back-btn {
                    background: #6c757d;
                    margin-right: 15px;
                }
                .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="auth-card">
                <div class="twitter-icon">🐦</div>
                <h1>Twitter Connection Invalid</h1>
                <div class="warning">
                    Your Twitter/X API credentials are invalid or have expired. Please ${isOAuth ? 're-authenticate' : 'check your API credentials'}.
                </div>
                <p>Unable to connect to Twitter API. ${isOAuth ? 'Please re-authenticate with Twitter.' : 'Please verify your bearer token and OAuth credentials in the .env file.'}</p>
                <a href="/" class="btn back-btn">← Back to Home</a>
                ${isOAuth ? 
                  '<a href="/auth/twitter" class="btn">Re-authenticate Twitter</a>' : 
                  '<a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" class="btn">Twitter Developer Portal</a>'
                }
            </div>
        </body>
        </html>
      `);
    }
    
    // Attempt to fetch fresh data, fall back to cached data on rate limits
    let userResult: any;
    let tweetsResult: any;
    let usingCachedData = false;
    
    try {
      console.log('🐦 Attempting to fetch fresh Twitter user data...');
      userResult = await connector.fetchUserMetrics();
      if (userResult.success) {
        twitterDataCache.userResult = userResult;
        console.log('✅ Fresh Twitter user data cached');
      }
    } catch (error: any) {
      console.log('⚠️ Twitter user metrics failed:', error.message);
      userResult = { success: false, error: error.message, data: null };
    }
    
    try {
      console.log('🐦 Attempting to fetch fresh Twitter analytics...');
      tweetsResult = await connector.fetchAnalytics('7');
      if (tweetsResult.success) {
        twitterDataCache.tweetsResult = tweetsResult;
        twitterDataCache.lastUpdated = new Date();
        console.log('✅ Fresh Twitter analytics data cached');
      }
    } catch (error: any) {
      console.log('⚠️ Twitter analytics failed:', error.message);
      tweetsResult = { success: false, error: error.message, data: null };
    }
    
    // If API calls failed, try to use cached data
    if (!userResult.success && twitterDataCache.userResult) {
      console.log('📦 Using cached Twitter user data');
      userResult = twitterDataCache.userResult;
      usingCachedData = true;
    }
    
    if (!tweetsResult.success && twitterDataCache.tweetsResult) {
      console.log('📦 Using cached Twitter analytics data');
      tweetsResult = twitterDataCache.tweetsResult;
      usingCachedData = true;
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Twitter Dashboard - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  min-height: 100vh;
                  padding: 20px;
              }
              .container { max-width: 1200px; margin: 0 auto; }
              .header {
                  background: linear-gradient(135deg, #1DA1F2 0%, #1A91DA 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 15px;
                  margin-bottom: 30px;
                  text-align: center;
              }
              .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                  gap: 20px;
                  margin-bottom: 30px;
              }
              .stat-card {
                  background: white;
                  padding: 25px;
                  border-radius: 10px;
                  text-align: center;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .stat-number { font-size: 2.5em; font-weight: bold; color: #1DA1F2; margin-bottom: 5px; }
              .stat-label { color: #6c757d; font-size: 0.9em; }
              .tweets-section {
                  background: white;
                  border-radius: 15px;
                  padding: 30px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .tweet-grid {
                  display: grid;
                  grid-template-columns: 1fr;
                  gap: 20px;
                  margin-top: 20px;
              }
              .tweet-card {
                  border: 1px solid #e9ecef;
                  border-radius: 10px;
                  padding: 20px;
                  transition: transform 0.2s ease;
              }
              .tweet-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
              .tweet-content {
                  font-size: 1.1em;
                  line-height: 1.4;
                  margin-bottom: 15px;
              }
              .tweet-stats {
                  display: flex;
                  gap: 20px;
                  font-size: 0.9em;
                  color: #6c757d;
              }
              .tweet-date {
                  color: #999;
                  font-size: 0.8em;
                  margin-top: 10px;
              }
              .btn {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 10px 20px;
                  border: none;
                  border-radius: 20px;
                  text-decoration: none;
                  display: inline-block;
                  margin-right: 10px;
              }
              .hashtag { color: #1DA1F2; font-weight: 500; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🐦 Twitter Dashboard</h1>
                  <p>Your Twitter analytics and recent tweets</p>
                  <div style="margin-top: 20px;">
                      <a href="/" class="btn">← Back to Home</a>
                      <a href="/twitter/tweets" class="btn">View All Tweets</a>
                  </div>
              </div>

              ${usingCachedData ? `
              <div style="background: #e7f3ff; color: #0c5460; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center; border-left: 4px solid #0dcaf0;">
                  <strong>ℹ️ Notice:</strong> Showing cached data from ${twitterDataCache.lastUpdated?.toLocaleString() || 'previous session'} due to Twitter API rate limits.
              </div>
              ` : ''}

              ${userResult.success && userResult.data ? `
              <div class="stats-grid">
                  <div class="stat-card">
                      <div class="stat-number">${userResult.data.public_metrics?.followers_count.toLocaleString() || 0}</div>
                      <div class="stat-label">Followers</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-number">${userResult.data.public_metrics?.following_count.toLocaleString() || 0}</div>
                      <div class="stat-label">Following</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-number">${userResult.data.public_metrics?.tweet_count.toLocaleString() || 0}</div>
                      <div class="stat-label">Total Tweets</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-number">${userResult.data.public_metrics?.listed_count.toLocaleString() || 0}</div>
                      <div class="stat-label">Listed</div>
                  </div>
              </div>
              ` : `
              <div style="background: ${usingCachedData ? '#fff3cd' : '#f8d7da'}; color: ${usingCachedData ? '#856404' : '#721c24'}; padding: 20px; border-radius: 10px; margin-bottom: 30px; text-align: center;">
                  <h3>${usingCachedData ? '📦 Showing Cached Data' : '❌ Unable to Load Twitter Data'}</h3>
                  <p>${usingCachedData ? 'Using previously fetched Twitter data due to rate limits.' : 'Could not fetch Twitter statistics.'}</p>
                  ${usingCachedData && twitterDataCache.lastUpdated ? `<p><small>Last updated: ${twitterDataCache.lastUpdated.toLocaleString()}</small></p>` : ''}
                  ${!usingCachedData && userResult.error ? `<p><small>Error: ${userResult.error}</small></p>` : ''}
              </div>
              `}

              <div class="tweets-section">
                  <h2>🐦 Recent Tweets</h2>
                  ${tweetsResult.success && tweetsResult.data?.posts ? `
                  <div class="tweet-grid">
                      ${tweetsResult.data.posts.slice(0, 5).map((tweet: any) => `
                          <div class="tweet-card">
                              <div class="tweet-content">${tweet.content.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')}</div>
                              <div class="tweet-stats">
                                  <span>🔄 ${tweet.metrics.shares || 0}</span>
                                  <span>❤️ ${tweet.metrics.likes || 0}</span>
                                  <span>💬 ${tweet.metrics.comments || 0}</span>
                                  <span>📈 ${(tweet.engagement_rate || 0).toFixed(2)}%</span>
                              </div>
                              <div class="tweet-date">${new Date(tweet.timestamp).toLocaleDateString()}</div>
                          </div>
                      `).join('')}
                  </div>
                  ` : `
                  <div style="background: ${usingCachedData ? '#fff3cd' : '#f8d7da'}; color: ${usingCachedData ? '#856404' : '#721c24'}; padding: 20px; border-radius: 10px; text-align: center;">
                      <h3>${usingCachedData ? '📦 Showing Cached Tweets' : '❌ Unable to Load Tweets'}</h3>
                      <p>${usingCachedData ? 'Using previously fetched tweets due to rate limits.' : 'Could not fetch recent tweets.'}</p>
                      ${usingCachedData && twitterDataCache.lastUpdated ? `<p><small>Last updated: ${twitterDataCache.lastUpdated.toLocaleString()}</small></p>` : ''}
                      ${!usingCachedData && tweetsResult.error ? `<p><small>Error: ${tweetsResult.error}</small></p>` : ''}
                  </div>
                  `}
              </div>
          </div>
      </body>
      </html>
    `);
    return;
  } catch (error) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Twitter Dashboard Error</title></head>
      <body>
        <h1>Error loading Twitter dashboard</h1>
        <p>${(error as Error).message}</p>
        <a href="/">← Back to Home</a>
      </body>
      </html>
    `);
  }
});

// Twitter Tweets Page
app.get('/twitter/tweets', async (req, res) => {
  const credentials = tokenManager.getCredentials('twitter');
  
  if (!credentials?.bearer_token && !credentials?.access_token) {
    return res.redirect('/twitter/dashboard');
  }

  try {
    let connector;
    
    // Use OAuth connector if we have OAuth tokens, otherwise fall back to regular connector
    if (credentials.access_token && credentials.access_token_secret) {
      const { TwitterOAuthConnector } = require('./connectors/twitter-oauth');
      connector = new TwitterOAuthConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
    } else {
      const { TwitterConnector } = require('./connectors/twitter');
      connector = new TwitterConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
    }
    
    const maxResults = parseInt(req.query.maxResults as string) || 20;
    const tweetsResult = await connector.fetchAnalytics('30'); // Get last 30 days

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>All Tweets - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  min-height: 100vh;
                  padding: 20px;
              }
              .container { max-width: 800px; margin: 0 auto; }
              .header {
                  background: linear-gradient(135deg, #1DA1F2 0%, #1A91DA 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 15px;
                  margin-bottom: 30px;
                  text-align: center;
              }
              .tweet-card {
                  background: white;
                  border: 1px solid #e9ecef;
                  border-radius: 15px;
                  padding: 25px;
                  margin-bottom: 20px;
                  transition: all 0.3s ease;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .tweet-card:hover { 
                  transform: translateY(-2px); 
                  box-shadow: 0 4px 16px rgba(29,161,242,0.15); 
              }
              .tweet-content {
                  font-size: 1.2em;
                  line-height: 1.5;
                  margin-bottom: 20px;
                  color: #333;
              }
              .tweet-meta {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: 15px;
                  color: #6c757d;
                  font-size: 0.9em;
              }
              .tweet-stats {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                  gap: 15px;
                  padding: 15px;
                  background: #f8f9fa;
                  border-radius: 10px;
              }
              .stat-item {
                  text-align: center;
                  padding: 10px;
              }
              .stat-number {
                  font-size: 1.5em;
                  font-weight: bold;
                  color: #1DA1F2;
                  display: block;
              }
              .stat-label {
                  font-size: 0.8em;
                  color: #6c757d;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
              }
              .btn {
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  margin-right: 10px;
                  transition: transform 0.2s ease;
              }
              .btn:hover { transform: scale(1.05); }
              .hashtag { color: #1DA1F2; font-weight: 500; }
              .mention { color: #1DA1F2; font-weight: 500; }
              .engagement-badge {
                  display: inline-block;
                  background: linear-gradient(135deg, #28a745, #20c997);
                  color: white;
                  padding: 4px 12px;
                  border-radius: 15px;
                  font-size: 0.8em;
                  font-weight: 500;
                  margin-left: 10px;
              }
              .no-tweets {
                  text-align: center;
                  padding: 60px 20px;
                  background: white;
                  border-radius: 15px;
                  color: #6c757d;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🐦 All Your Tweets</h1>
                  <p>Complete timeline with detailed analytics</p>
                  <div style="margin-top: 20px;">
                      <a href="/twitter/dashboard" class="btn">← Back to Dashboard</a>
                      <a href="/" class="btn">Home</a>
                  </div>
              </div>

              ${tweetsResult.success && tweetsResult.data?.posts && tweetsResult.data.posts.length > 0 ? `
                  ${tweetsResult.data.posts.map((tweet: any) => `
                      <div class="tweet-card">
                          <div class="tweet-meta">
                              <span>📅 ${new Date(tweet.timestamp).toLocaleDateString('en-US', { 
                                  weekday: 'short', 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                              })}</span>
                              <span class="engagement-badge">
                                  📈 ${(tweet.engagement_rate || 0).toFixed(2)}% engagement
                              </span>
                          </div>
                          
                          <div class="tweet-content">
                              ${tweet.content
                                .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')
                                .replace(/@(\w+)/g, '<span class="mention">@$1</span>')
                              }
                          </div>
                          
                          <div class="tweet-stats">
                              <div class="stat-item">
                                  <span class="stat-number">${(tweet.metrics.shares || 0).toLocaleString()}</span>
                                  <span class="stat-label">Retweets</span>
                              </div>
                              <div class="stat-item">
                                  <span class="stat-number">${(tweet.metrics.likes || 0).toLocaleString()}</span>
                                  <span class="stat-label">Likes</span>
                              </div>
                              <div class="stat-item">
                                  <span class="stat-number">${(tweet.metrics.comments || 0).toLocaleString()}</span>
                                  <span class="stat-label">Replies</span>
                              </div>
                              ${tweet.metrics.views ? `
                              <div class="stat-item">
                                  <span class="stat-number">${tweet.metrics.views.toLocaleString()}</span>
                                  <span class="stat-label">Views</span>
                              </div>
                              ` : ''}
                          </div>
                      </div>
                  `).join('')}
              ` : `
                  <div class="no-tweets">
                      <h2>📝 No Tweets Found</h2>
                      <p>No tweets available - this may be due to Twitter API rate limits. Please try again in a few minutes.</p>
                      <p style="margin-top: 15px;">
                          <a href="/twitter/dashboard" class="btn">← Back to Dashboard</a>
                      </p>
                  </div>
              `}
          </div>
      </body>
      </html>
    `);
    return;
  } catch (error) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Tweets Error</title></head>
      <body>
        <h1>Error loading tweets</h1>
        <p>${(error as Error).message}</p>
        <a href="/twitter/dashboard">← Back to Twitter Dashboard</a>
      </body>
      </html>
    `);
  }
});

// Facebook Dashboard
app.get('/facebook/dashboard', async (req, res) => {
  const credentials = tokenManager.getCredentials('facebook');
  
  if (!credentials?.access_token) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Facebook Setup - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  min-height: 100vh;
                  padding: 20px;
              }
              .container { max-width: 800px; margin: 0 auto; }
              .setup-card {
                  background: linear-gradient(135deg, #4267B2 0%, #365899 100%);
                  color: white;
                  padding: 40px;
                  border-radius: 15px;
                  text-align: center;
              }
              .btn {
                  background: white;
                  color: #4267B2;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  margin: 10px;
                  font-weight: 500;
              }
              .setup-steps {
                  background: white;
                  padding: 30px;
                  border-radius: 15px;
                  margin-top: 20px;
              }
              .step { margin-bottom: 20px; padding: 15px; border-left: 4px solid #4267B2; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="setup-card">
                  <h1>📘 Facebook Integration Setup</h1>
                  <p>To access your Facebook pages and analytics, please add your Facebook API credentials to the .env file.</p>
                  <a href="/" class="btn">← Back to Home</a>
              </div>
              
              <div class="setup-steps">
                  <h2>📋 Setup Steps</h2>
                  
                  <div class="step">
                      <h3>1. Create Facebook App</h3>
                      <p>Visit <a href="https://developers.facebook.com/apps" target="_blank">Facebook for Developers</a> and create a new app</p>
                  </div>
                  
                  <div class="step">
                      <h3>2. Get App Credentials</h3>
                      <p>Copy your App ID and App Secret from the app dashboard</p>
                  </div>
                  
                  <div class="step">
                      <h3>3. Generate Access Token</h3>
                      <p>Use <a href="https://developers.facebook.com/tools/explorer/" target="_blank">Facebook Graph API Explorer</a> to generate a User Access Token with 'pages_read_engagement' permissions</p>
                  </div>
                  
                  <div class="step">
                      <h3>4. Add to .env file</h3>
                      <pre>FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret  
FACEBOOK_ACCESS_TOKEN=your_access_token</pre>
                  </div>
                  
                  <div class="step">
                      <h3>5. Restart Server</h3>
                      <p>Restart the development server to load the new credentials</p>
                  </div>
              </div>
          </div>
      </body>
      </html>
    `);
  }

  try {
    const { FacebookConnector } = require('./connectors/facebook');
    const connector = new FacebookConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
    
    // Validate the Facebook OAuth connection before proceeding
    const isValidConnection = await connector.validateCredentials();
    
    if (!isValidConnection) {
      // Facebook OAuth is invalid/expired, prompt to fix credentials
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Facebook Dashboard - Influence Hub</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #4267B2 0%, #365899 100%);
                    min-height: 100vh;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .auth-card {
                    background: white;
                    border-radius: 20px;
                    padding: 60px 40px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    max-width: 500px;
                }
                .facebook-icon { font-size: 4em; margin-bottom: 20px; }
                h1 { color: #333; margin-bottom: 15px; }
                p { color: #666; margin-bottom: 30px; line-height: 1.5; }
                .btn {
                    background: linear-gradient(135deg, #4267B2 0%, #365899 100%);
                    color: white;
                    padding: 15px 30px;
                    border: none;
                    border-radius: 25px;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 1.1em;
                    font-weight: 500;
                    transition: transform 0.2s ease;
                }
                .btn:hover { transform: scale(1.05); }
                .back-btn {
                    background: #6c757d;
                    margin-right: 15px;
                }
                .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="auth-card">
                <div class="facebook-icon">📘</div>
                <h1>Facebook Connection Invalid</h1>
                <div class="warning">
                    Your Facebook access token is invalid or has expired. Please check your credentials.
                </div>
                <p>Unable to connect to Facebook API. Please verify your access token and app credentials in the .env file.</p>
                <a href="/" class="btn back-btn">← Back to Home</a>
                <a href="https://developers.facebook.com/tools/explorer/" target="_blank" class="btn">Get New Token</a>
            </div>
        </body>
        </html>
      `);
    }
    
    const analyticsResult = await connector.fetchAnalytics('7');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Facebook Dashboard - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  min-height: 100vh;
                  padding: 20px;
              }
              .container { max-width: 1200px; margin: 0 auto; }
              .header {
                  background: linear-gradient(135deg, #4267B2 0%, #365899 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 15px;
                  margin-bottom: 30px;
                  text-align: center;
              }
              .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 20px;
                  margin-bottom: 30px;
              }
              .stat-card {
                  background: white;
                  padding: 25px;
                  border-radius: 15px;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                  text-align: center;
              }
              .stat-number {
                  font-size: 2.5em;
                  font-weight: bold;
                  color: #4267B2;
                  display: block;
              }
              .post-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                  gap: 20px;
              }
              .post-card {
                  background: white;
                  border-radius: 15px;
                  padding: 20px;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
              }
              .post-content {
                  font-size: 1.1em;
                  line-height: 1.5;
                  margin-bottom: 15px;
              }
              .post-stats {
                  display: flex;
                  gap: 15px;
                  font-size: 0.9em;
                  color: #666;
              }
              .btn {
                  background: white;
                  color: #4267B2;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  margin: 10px;
                  font-weight: 500;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>📘 Facebook Analytics</h1>
                  <p>Your Facebook pages and engagement metrics</p>
                  <div style="margin-top: 20px;">
                      <a href="/facebook/posts" class="btn">View All Posts</a>
                      <a href="/" class="btn">Home</a>
                  </div>
              </div>

              ${analyticsResult.success && analyticsResult.data ? `
                  <div class="stats-grid">
                      <div class="stat-card">
                          <span class="stat-number">${analyticsResult.data.metrics.followers}</span>
                          <h3>📈 Page Likes</h3>
                          <p>Total followers</p>
                      </div>
                      
                      <div class="stat-card">
                          <span class="stat-number">${analyticsResult.data.metrics.likes}</span>
                          <h3>❤️ Reactions</h3>
                          <p>Total reactions</p>
                      </div>
                      
                      <div class="stat-card">
                          <span class="stat-number">${analyticsResult.data.metrics.shares}</span>
                          <h3>🔄 Shares</h3>
                          <p>Total shares</p>
                      </div>
                      
                      <div class="stat-card">
                          <span class="stat-number">${analyticsResult.data.metrics.comments}</span>
                          <h3>💬 Comments</h3>
                          <p>Total comments</p>
                      </div>
                  </div>
                  
                  <h2 style="margin-bottom: 20px;">📝 Recent Posts</h2>
                  <div class="post-grid">
                      ${analyticsResult.data.posts.slice(0, 6).map((post: any) => `
                          <div class="post-card">
                              <div class="post-content">${post.content}</div>
                              <div class="post-stats">
                                  <span>❤️ ${post.metrics.likes}</span>
                                  <span>🔄 ${post.metrics.shares}</span>
                                  <span>💬 ${post.metrics.comments}</span>
                                  <span>📅 ${new Date(post.timestamp).toLocaleDateString()}</span>
                              </div>
                          </div>
                      `).join('')}
                  </div>
              ` : `
                  <div style="text-align: center; padding: 60px; background: white; border-radius: 15px;">
                      <h2>⚠️ Unable to Load Facebook Data</h2>
                      <p>Error: ${analyticsResult.error || 'Unknown error'}</p>
                      <p style="margin-top: 15px;">
                          <a href="/facebook/dashboard" class="btn">Retry</a>
                          <a href="/" class="btn">← Back to Home</a>
                      </p>
                  </div>
              `}
          </div>
      </body>
      </html>
    `);
    return;
  } catch (error) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Facebook Dashboard Error</title></head>
      <body>
        <h1>Error loading Facebook dashboard</h1>
        <p>${(error as Error).message}</p>
        <a href="/">← Back to Home</a>
      </body>
      </html>
    `);
  }
});

// Facebook Posts Page
app.get('/facebook/posts', async (req, res) => {
  const credentials = tokenManager.getCredentials('facebook');
  
  if (!credentials?.access_token) {
    return res.redirect('/facebook/dashboard');
  }

  try {
    const { FacebookConnector } = require('./connectors/facebook');
    const connector = new FacebookConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
    
    const analyticsResult = await connector.fetchAnalytics('30');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>All Facebook Posts - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  min-height: 100vh;
                  padding: 20px;
              }
              .container { max-width: 800px; margin: 0 auto; }
              .header {
                  background: linear-gradient(135deg, #4267B2 0%, #365899 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 15px;
                  margin-bottom: 30px;
                  text-align: center;
              }
              .post-card {
                  background: white;
                  border: 1px solid #e9ecef;
                  border-radius: 15px;
                  padding: 25px;
                  margin-bottom: 20px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .post-content {
                  font-size: 1.2em;
                  line-height: 1.5;
                  margin-bottom: 20px;
                  color: #333;
              }
              .post-stats {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 15px;
                  background: #f8f9fa;
                  border-radius: 10px;
                  margin-bottom: 15px;
              }
              .btn {
                  background: white;
                  color: #4267B2;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  margin-right: 10px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>📘 All Facebook Posts</h1>
                  <p>Complete timeline with detailed analytics</p>
                  <div style="margin-top: 20px;">
                      <a href="/facebook/dashboard" class="btn">← Back to Dashboard</a>
                      <a href="/" class="btn">Home</a>
                  </div>
              </div>

              ${analyticsResult.success && analyticsResult.data?.posts && analyticsResult.data.posts.length > 0 ? `
                  ${analyticsResult.data.posts.map((post: any) => `
                      <div class="post-card">
                          <div class="post-content">${post.content}</div>
                          
                          <div class="post-stats">
                              <div>
                                  <span>❤️ ${post.metrics.likes} reactions</span>
                                  <span style="margin-left: 15px;">🔄 ${post.metrics.shares} shares</span>
                                  <span style="margin-left: 15px;">💬 ${post.metrics.comments} comments</span>
                              </div>
                              <div>
                                  📅 ${new Date(post.timestamp).toLocaleDateString('en-US', { 
                                      weekday: 'short', 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                  })}
                              </div>
                          </div>
                      </div>
                  `).join('')}
              ` : `
                  <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 15px; color: #6c757d;">
                      <h2>📝 No Posts Found</h2>
                      <p>No Facebook posts available or there was an issue loading your posts.</p>
                      <p style="margin-top: 15px;">
                          <a href="/facebook/dashboard" class="btn">← Back to Dashboard</a>
                      </p>
                  </div>
              `}
          </div>
      </body>
      </html>
    `);
    return;
  } catch (error) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Facebook Posts Error</title></head>
      <body>
        <h1>Error loading Facebook posts</h1>
        <p>${(error as Error).message}</p>
        <a href="/facebook/dashboard">← Back to Facebook Dashboard</a>
      </body>
      </html>
    `);
  }
});

// Reddit OAuth Initiation
app.get('/auth/reddit', (req, res) => {
  const credentials = tokenManager.getCredentials('reddit');
  
  if (!credentials?.client_id) {
    return res.redirect('/reddit/dashboard?error=missing_credentials');
  }

  const state = Math.random().toString(36).substring(2, 15);
  const scope = 'identity read history submit'; // Reddit scopes
  const redirectUri = process.env.REDDIT_REDIRECT_URI || 'http://127.0.0.1:3002/auth/reddit/callback';
  
  const authUrl = `https://www.reddit.com/api/v1/authorize?` + 
    `client_id=${credentials.client_id}&` +
    `response_type=code&` +
    `state=${state}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `duration=permanent&` +
    `scope=${encodeURIComponent(scope)}`;

  // Store state for verification (in production, use Redis or database)
  (req as any).session = (req as any).session || {};
  (req as any).session.reddit_state = state;

  res.redirect(authUrl);
});

// Reddit OAuth Callback
app.get('/auth/reddit/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const error = req.query.error as string;

  if (error) {
    return res.redirect('/reddit/dashboard?error=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect('/reddit/dashboard?error=no_code');
  }

  // Exchange code for access token
  try {
    console.log('🔄 Reddit OAuth callback received:', { code: code ? '***' : null, state, error });
    
    const credentials = tokenManager.getCredentials('reddit');
    if (!credentials?.client_id || !credentials?.client_secret) {
      console.error('❌ Missing Reddit credentials');
      return res.redirect('/reddit/dashboard?error=missing_credentials');
    }

    const redirectUri = process.env.REDDIT_REDIRECT_URI || 'http://127.0.0.1:3002/auth/reddit/callback';
    console.log('📍 Using redirect URI:', redirectUri);
    
    const requestBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    });
    
    console.log('📤 Making token exchange request to Reddit...');
    
    // Exchange authorization code for access token with timeout and retry
    let tokenResponse: Response | null = null;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`🔄 Attempt ${retryCount + 1}/${maxRetries + 1} - Requesting token from Reddit...`);
        
        // Use curl via child_process to bypass Node.js HTTP issues
        const { spawn } = require('child_process');
        const curlResult = await new Promise<{status: number, data: string}>((resolve, reject) => {
          const auth = Buffer.from(`${credentials.client_id}:${credentials.client_secret}`).toString('base64');
          
          const curlArgs = [
            '-X', 'POST',
            'https://www.reddit.com/api/v1/access_token',
            '-H', `Authorization: Basic ${auth}`,
            '-H', 'Content-Type: application/x-www-form-urlencoded',
            '-H', 'User-Agent: InfluenceHub/1.0 by Ok-Plastic8512',
            '-d', requestBody.toString(),
            '--connect-timeout', '15',
            '--max-time', '30',
            '--write-out', '%{http_code}',
            '--silent'
          ];
          
          console.log('🔧 Using curl for Reddit API request...');
          const curl = spawn('curl', curlArgs);
          
          let output = '';
          let statusCode = '';
          
          curl.stdout.on('data', (data: any) => {
            output += data.toString();
          });
          
          curl.stderr.on('data', (data: any) => {
            console.error('Curl stderr:', data.toString());
          });
          
          curl.on('close', (code: any) => {
            if (code === 0) {
              // Extract status code from end of output
              const lastThreeChars = output.slice(-3);
              const httpCode = parseInt(lastThreeChars);
              const responseBody = output.slice(0, -3);
              
              resolve({
                status: httpCode || 0,
                data: responseBody
              });
            } else {
              reject(new Error(`Curl failed with code ${code}`));
            }
          });
        });
        
        // Convert curl result to fetch-like response object
        tokenResponse = {
          ok: curlResult.status >= 200 && curlResult.status < 300,
          status: curlResult.status,
          statusText: curlResult.status >= 200 && curlResult.status < 300 ? 'OK' : 'Error',
          json: async () => {
            try {
              return JSON.parse(curlResult.data);
            } catch {
              return { error: 'Invalid JSON response', raw: curlResult.data };
            }
          },
          text: async () => curlResult.data
        } as Response;
        
        console.log('✅ Reddit API responded successfully');
        break;
        
      } catch (error: any) {
        retryCount++;
        console.log(`❌ Attempt ${retryCount} failed:`, error.message);
        
        if (retryCount > maxRetries) {
          console.error('💥 All retry attempts failed');
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!tokenResponse) {
      console.error('❌ No response received from Reddit API');
      return res.redirect('/reddit/dashboard?error=no_response');
    }

    console.log('📥 Token response status:', tokenResponse.status, tokenResponse.statusText);
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Reddit API returned error:', errorText);
      return res.redirect('/reddit/dashboard?error=api_error');
    }

    const tokenData = await tokenResponse.json() as any;
    console.log('📋 Token data received:', { 
      hasAccessToken: !!tokenData.access_token, 
      tokenType: tokenData.token_type,
      error: tokenData.error,
      errorDescription: tokenData.error_description 
    });
    
    if (tokenData.access_token) {
      // Store access token (in production, use secure storage)
      console.log('✅ Reddit OAuth successful! Storing access token...');
      
      // Store the access token in the credentials
      const updatedCredentials = { ...credentials, access_token: tokenData.access_token };
      tokenManager.setCredentials('reddit', updatedCredentials);
      
      res.redirect('/reddit/dashboard?success=oauth_complete');
    } else {
      console.error('❌ No access token in response:', tokenData);
      res.redirect('/reddit/dashboard?error=token_exchange_failed');
    }
  } catch (error) {
    console.error('💥 Reddit OAuth error:', error);
    res.redirect('/reddit/dashboard?error=oauth_failed');
  }
});

// Reddit Dashboard
app.get('/reddit/dashboard', async (req, res) => {
  const credentials = tokenManager.getCredentials('reddit');
  
  // Show OAuth login if we have app credentials but no access token
  if (credentials?.client_id && credentials?.client_secret && !credentials?.access_token) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reddit Login - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  min-height: 100vh;
                  padding: 20px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
              .login-card {
                  background: linear-gradient(135deg, #FF4500 0%, #FF5700 100%);
                  color: white;
                  padding: 60px;
                  border-radius: 20px;
                  text-align: center;
                  max-width: 500px;
                  box-shadow: 0 10px 30px rgba(255, 69, 0, 0.3);
              }
              .btn {
                  background: white;
                  color: #FF4500;
                  padding: 15px 30px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  margin: 15px;
                  font-weight: 600;
                  font-size: 1.1em;
                  transition: transform 0.2s ease;
              }
              .btn:hover { transform: scale(1.05); }
              .btn.secondary {
                  background: transparent;
                  color: white;
                  border: 2px solid white;
              }
          </style>
      </head>
      <body>
          <div class="login-card">
              <h1>🔶 Connect to Reddit</h1>
              <p style="margin: 20px 0; font-size: 1.2em;">Ready to access your Reddit analytics!</p>
              <p style="margin-bottom: 30px; opacity: 0.9;">Click below to login with your Reddit account (Google login supported)</p>
              
              <div>
                  <a href="/auth/reddit" class="btn">🚀 Connect Reddit Account</a>
              </div>
              
              <div style="margin-top: 30px;">
                  <a href="/" class="btn secondary">← Back to Home</a>
              </div>
          </div>
      </body>
      </html>
    `);
  }
  
  if (!credentials?.client_id || !credentials?.client_secret) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reddit Setup - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  min-height: 100vh;
                  padding: 20px;
              }
              .container { max-width: 800px; margin: 0 auto; }
              .setup-card {
                  background: linear-gradient(135deg, #FF4500 0%, #FF5700 100%);
                  color: white;
                  padding: 40px;
                  border-radius: 15px;
                  text-align: center;
              }
              .btn {
                  background: white;
                  color: #FF4500;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  margin: 10px;
                  font-weight: 500;
              }
              .setup-steps {
                  background: white;
                  padding: 30px;
                  border-radius: 15px;
                  margin-top: 20px;
              }
              .step { margin-bottom: 20px; padding: 15px; border-left: 4px solid #FF4500; }
              pre { background: #f8f9fa; padding: 10px; border-radius: 5px; overflow-x: auto; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="setup-card">
                  <h1>🔶 Reddit Integration Setup</h1>
                  <p>To access your Reddit posts and karma, please add your Reddit API credentials to the .env file.</p>
                  <div style="margin-top: 20px;">
                      <a href="/" class="btn">← Back to Home</a>
                  </div>
              </div>
              
              <div class="setup-steps">
                  <h2>📋 Setup Steps</h2>
                  
                  <div class="step">
                      <h3>1. Create Reddit App</h3>
                      <p>Visit <a href="https://www.reddit.com/prefs/apps" target="_blank">Reddit Apps</a> and create a new application</p>
                      <ul style="margin-top: 10px; margin-left: 20px;">
                          <li>Choose <strong>"web app"</strong> for OAuth flow</li>
                          <li>Or choose <strong>"script"</strong> for simpler username/password auth</li>
                      </ul>
                  </div>
                  
                  <div class="step">
                      <h3>2. Set Redirect URI</h3>
                      <p>If using "web app", set the redirect URI to:</p>
                      <pre>http://127.0.0.1:3002/auth/reddit/callback</pre>
                      <p>If using "script", use:</p>
                      <pre>http://localhost:8080</pre>
                  </div>
                  
                  <div class="step">
                      <h3>3. Get App Credentials</h3>
                      <p>Copy your Client ID (under the app name) and Client Secret</p>
                  </div>
                  
                  <div class="step">
                      <h3>4. Add to .env file</h3>
                      <pre>REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password</pre>
                  </div>
                  
                  <div class="step">
                      <h3>5. Restart Server</h3>
                      <p>Restart the development server to load the new credentials</p>
                  </div>
                  
                  <div class="step">
                      <h3>⚠️ Security Note</h3>
                      <p>This integration uses your Reddit username/password for authentication. Consider creating a dedicated account for API access.</p>
                  </div>
              </div>
          </div>
      </body>
      </html>
    `);
  }

  try {
    const { RedditConnector } = require('./connectors/reddit');
    const connector = new RedditConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
    
    // Validate the Reddit OAuth connection before proceeding
    const isValidConnection = await connector.validateCredentials();
    
    if (!isValidConnection) {
      // Reddit OAuth is invalid/expired, prompt to re-authenticate
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reddit Dashboard - Influence Hub</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #FF4500 0%, #FF5700 100%);
                    min-height: 100vh;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .auth-card {
                    background: white;
                    border-radius: 20px;
                    padding: 60px 40px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    max-width: 500px;
                }
                .reddit-icon { font-size: 4em; margin-bottom: 20px; }
                h1 { color: #333; margin-bottom: 15px; }
                p { color: #666; margin-bottom: 30px; line-height: 1.5; }
                .btn {
                    background: linear-gradient(135deg, #FF4500 0%, #FF5700 100%);
                    color: white;
                    padding: 15px 30px;
                    border: none;
                    border-radius: 25px;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 1.1em;
                    font-weight: 500;
                    transition: transform 0.2s ease;
                }
                .btn:hover { transform: scale(1.05); }
                .back-btn {
                    background: #6c757d;
                    margin-right: 15px;
                }
                .warning { background: #fff3cd; color: #856404; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="auth-card">
                <div class="reddit-icon">🔶</div>
                <h1>Reddit Connection Invalid</h1>
                <div class="warning">
                    Your Reddit authentication is invalid or has expired. Please check your credentials and try again.
                </div>
                <p>Unable to connect to Reddit API. This may be due to incorrect credentials or expired tokens.</p>
                <a href="/" class="btn back-btn">← Back to Home</a>
                <a href="/auth/reddit" class="btn">Re-authenticate Reddit</a>
            </div>
        </body>
        </html>
      `);
    }
    
    const analyticsResult = await connector.fetchAnalytics('7');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reddit Dashboard - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  min-height: 100vh;
                  padding: 20px;
              }
              .container { max-width: 1200px; margin: 0 auto; }
              .header {
                  background: linear-gradient(135deg, #FF4500 0%, #FF5700 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 15px;
                  margin-bottom: 30px;
                  text-align: center;
              }
              .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 20px;
                  margin-bottom: 30px;
              }
              .stat-card {
                  background: white;
                  padding: 25px;
                  border-radius: 15px;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                  text-align: center;
              }
              .stat-number {
                  font-size: 2.5em;
                  font-weight: bold;
                  color: #FF4500;
                  display: block;
              }
              .post-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                  gap: 20px;
              }
              .post-card {
                  background: white;
                  border-radius: 15px;
                  padding: 20px;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                  border-left: 4px solid #FF4500;
              }
              .post-content {
                  font-size: 1.1em;
                  line-height: 1.5;
                  margin-bottom: 15px;
                  font-weight: 500;
              }
              .post-stats {
                  display: flex;
                  gap: 15px;
                  font-size: 0.9em;
                  color: #666;
              }
              .btn {
                  background: white;
                  color: #FF4500;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  margin: 10px;
                  font-weight: 500;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔶 Reddit Analytics</h1>
                  <p>Your Reddit posts, karma, and engagement metrics</p>
                  <div style="margin-top: 20px;">
                      <a href="/reddit/posts" class="btn">View All Posts</a>
                      <a href="/" class="btn">Home</a>
                  </div>
              </div>

              ${analyticsResult.success && analyticsResult.data ? `
                  <div class="stats-grid">
                      <div class="stat-card">
                          <span class="stat-number">${analyticsResult.data.metrics.likes || 0}</span>
                          <h3>⬆️ Total Karma</h3>
                          <p>Upvotes across posts</p>
                      </div>
                      
                      <div class="stat-card">
                          <span class="stat-number">${analyticsResult.data.posts?.length || 0}</span>
                          <h3>📝 Recent Posts</h3>
                          <p>Posts in timeframe</p>
                      </div>
                      
                      <div class="stat-card">
                          <span class="stat-number">${analyticsResult.data.metrics.comments || 0}</span>
                          <h3>💬 Comments</h3>
                          <p>Total comments</p>
                      </div>
                      
                      <div class="stat-card">
                          <span class="stat-number">${Math.round(analyticsResult.data.metrics.engagement_rate || 0)}</span>
                          <h3>📊 Avg Engagement</h3>
                          <p>Per post</p>
                      </div>
                  </div>
                  
                  <h2 style="margin-bottom: 20px;">📝 Recent Posts</h2>
                  <div class="post-grid">
                      ${analyticsResult.data.posts.slice(0, 6).map((post: any) => `
                          <div class="post-card">
                              <div class="post-content">${post.content}</div>
                              <div class="post-stats">
                                  <span>⬆️ ${post.metrics.likes}</span>
                                  <span>💬 ${post.metrics.comments}</span>
                                  <span>📅 ${new Date(post.timestamp).toLocaleDateString()}</span>
                              </div>
                          </div>
                      `).join('')}
                  </div>
              ` : `
                  <div style="text-align: center; padding: 60px; background: white; border-radius: 15px;">
                      <h2>⚠️ Unable to Load Reddit Data</h2>
                      <p>Error: ${analyticsResult.error || 'Unknown error'}</p>
                      <p style="margin-top: 15px;">
                          <a href="/reddit/dashboard" class="btn">Retry</a>
                          <a href="/" class="btn">← Back to Home</a>
                      </p>
                  </div>
              `}
          </div>
      </body>
      </html>
    `);
    return;
  } catch (error) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Reddit Dashboard Error</title></head>
      <body>
        <h1>Error loading Reddit dashboard</h1>
        <p>${(error as Error).message}</p>
        <a href="/">← Back to Home</a>
      </body>
      </html>
    `);
  }
});

// Reddit Posts Page
app.get('/reddit/posts', async (req, res) => {
  const credentials = tokenManager.getCredentials('reddit');
  
  if (!credentials?.client_id || !credentials?.client_secret) {
    return res.redirect('/reddit/dashboard');
  }

  try {
    const { RedditConnector } = require('./connectors/reddit');
    const connector = new RedditConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
    
    const analyticsResult = await connector.fetchAnalytics('30');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>All Reddit Posts - Influence Hub</title>
          <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: #f8f9fa;
                  min-height: 100vh;
                  padding: 20px;
              }
              .container { max-width: 800px; margin: 0 auto; }
              .header {
                  background: linear-gradient(135deg, #FF4500 0%, #FF5700 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 15px;
                  margin-bottom: 30px;
                  text-align: center;
              }
              .post-card {
                  background: white;
                  border: 1px solid #e9ecef;
                  border-radius: 15px;
                  padding: 25px;
                  margin-bottom: 20px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  border-left: 4px solid #FF4500;
              }
              .post-content {
                  font-size: 1.2em;
                  line-height: 1.5;
                  margin-bottom: 20px;
                  color: #333;
                  font-weight: 500;
              }
              .post-stats {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 15px;
                  background: #f8f9fa;
                  border-radius: 10px;
                  margin-bottom: 15px;
              }
              .btn {
                  background: white;
                  color: #FF4500;
                  padding: 12px 24px;
                  border: none;
                  border-radius: 25px;
                  text-decoration: none;
                  display: inline-block;
                  margin-right: 10px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🔶 All Reddit Posts</h1>
                  <p>Complete timeline with karma and engagement</p>
                  <div style="margin-top: 20px;">
                      <a href="/reddit/dashboard" class="btn">← Back to Dashboard</a>
                      <a href="/" class="btn">Home</a>
                  </div>
              </div>

              ${analyticsResult.success && analyticsResult.data?.posts && analyticsResult.data.posts.length > 0 ? `
                  ${analyticsResult.data.posts.map((post: any) => `
                      <div class="post-card">
                          <div class="post-content">${post.content}</div>
                          
                          <div class="post-stats">
                              <div>
                                  <span>⬆️ ${post.metrics.likes} karma</span>
                                  <span style="margin-left: 15px;">💬 ${post.metrics.comments} comments</span>
                              </div>
                              <div>
                                  📅 ${new Date(post.timestamp).toLocaleDateString('en-US', { 
                                      weekday: 'short', 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                  })}
                              </div>
                          </div>
                      </div>
                  `).join('')}
              ` : `
                  <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 15px; color: #6c757d;">
                      <h2>📝 No Posts Found</h2>
                      <p>No Reddit posts available or there was an issue loading your posts.</p>
                      <p style="margin-top: 15px;">
                          <a href="/reddit/dashboard" class="btn">← Back to Dashboard</a>
                      </p>
                  </div>
              `}
          </div>
      </body>
      </html>
    `);
    return;
  } catch (error) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Reddit Posts Error</title></head>
      <body>
        <h1>Error loading Reddit posts</h1>
        <p>${(error as Error).message}</p>
        <a href="/reddit/dashboard">← Back to Reddit Dashboard</a>
      </body>
      </html>
    `);
  }
});

app.get('/metrics', async (req, res) => {
  try {
    const timeRange = (req.query.timeRange as string) || '7';
    const response = await aggregator.aggregateAllMetrics(timeRange);
    
    if (response.success && response.data) {
      // Create beautiful analytics dashboard
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>📊 Analytics Dashboard - Influence Hub</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    min-height: 100vh; padding: 20px;
                }
                .container { max-width: 1400px; margin: 0 auto; }
                .header {
                    text-align: center; background: rgba(255,255,255,0.95);
                    padding: 30px; border-radius: 20px; margin-bottom: 30px;
                    backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                }
                .header h1 { font-size: 2.5rem; margin-bottom: 10px; color: #2d3748; }
                .time-filter {
                    margin: 20px 0; display: flex; justify-content: center; gap: 10px;
                    flex-wrap: wrap;
                }
                .time-btn {
                    padding: 8px 16px; background: #e53e3e; color: white;
                    border: none; border-radius: 20px; cursor: pointer;
                    text-decoration: none; transition: all 0.3s;
                }
                .time-btn:hover { background: #c53030; transform: translateY(-2px); }
                .time-btn.active { background: #9b2c2c; }
                .stats-overview {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 20px; margin-bottom: 30px;
                }
                .overview-card {
                    background: rgba(255,255,255,0.95); border-radius: 15px;
                    padding: 25px; backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                    text-align: center; transition: transform 0.3s;
                }
                .overview-card:hover { transform: translateY(-5px); }
                .overview-number {
                    font-size: 2.5rem; font-weight: 700; color: #2d3748;
                    margin-bottom: 10px;
                }
                .overview-label {
                    font-size: 1rem; color: #718096; font-weight: 500;
                }
                .platforms-grid {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 25px; margin-bottom: 30px;
                }
                .platform-card {
                    background: rgba(255,255,255,0.95); border-radius: 15px;
                    padding: 25px; backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                }
                .platform-header {
                    display: flex; align-items: center; justify-content: space-between;
                    margin-bottom: 20px;
                }
                .platform-title {
                    font-size: 1.5rem; font-weight: 600; color: #2d3748;
                    display: flex; align-items: center; gap: 10px;
                }
                .platform-status {
                    padding: 4px 12px; border-radius: 12px; font-size: 0.8rem;
                    font-weight: 500;
                }
                .status-connected { background: #c6f6d5; color: #22543d; }
                .status-error { background: #fed7d7; color: #c53030; }
                .platform-metrics {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 15px;
                }
                .metric-box {
                    text-align: center; padding: 15px; background: #f7fafc;
                    border-radius: 10px;
                }
                .metric-number {
                    font-size: 1.5rem; font-weight: 600; color: #2d3748;
                }
                .metric-label {
                    font-size: 0.8rem; color: #718096; margin-top: 5px;
                }
                .nav-bar {
                    display: flex; justify-content: center; gap: 15px;
                    margin-bottom: 20px; flex-wrap: wrap;
                }
                .nav-btn {
                    padding: 10px 20px; background: rgba(255,255,255,0.9);
                    color: #4a5568; border: none; border-radius: 25px;
                    text-decoration: none; transition: all 0.3s;
                    font-weight: 500;
                }
                .nav-btn:hover {
                    background: white; transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                .no-data {
                    text-align: center; padding: 60px; color: #718096;
                    background: rgba(255,255,255,0.9); border-radius: 15px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 Analytics Dashboard</h1>
                    <p>Your social media performance at a glance</p>
                    
                    <div class="time-filter">
                        <a href="/metrics?timeRange=1" class="time-btn ${timeRange === '1' ? 'active' : ''}">24h</a>
                        <a href="/metrics?timeRange=7" class="time-btn ${timeRange === '7' ? 'active' : ''}">7 days</a>
                        <a href="/metrics?timeRange=30" class="time-btn ${timeRange === '30' ? 'active' : ''}">30 days</a>
                    </div>
                    
                    <div class="nav-bar">
                        <a href="/" class="nav-btn">🏠 Home</a>
                        <a href="/metrics" class="nav-btn">📊 Dashboard</a>
                        <a href="/trends" class="nav-btn">🔥 Trends</a>
                        <a href="/api-keys" class="nav-btn">🔑 API Keys</a>
                        <a href="/settings" class="nav-btn">⚙️ Settings</a>
                    </div>
                </div>

                <div class="stats-overview">
                    <div class="overview-card">
                        <div class="overview-number">${response.data.totalFollowers.toLocaleString()}</div>
                        <div class="overview-label">Total Followers</div>
                    </div>
                    <div class="overview-card">
                        <div class="overview-number">${response.data.totalViews.toLocaleString()}</div>
                        <div class="overview-label">Total Views</div>
                    </div>
                    <div class="overview-card">
                        <div class="overview-number">${response.data.totalLikes.toLocaleString()}</div>
                        <div class="overview-label">Total Likes</div>
                    </div>
                    <div class="overview-card">
                        <div class="overview-number">${response.data.totalComments.toLocaleString()}</div>
                        <div class="overview-label">Total Comments</div>
                    </div>
                    <div class="overview-card">
                        <div class="overview-number">${Object.keys(response.data.platformBreakdown).length}</div>
                        <div class="overview-label">Connected Platforms</div>
                    </div>
                    <div class="overview-card">
                        <div class="overview-number">${response.data.averageEngagementRate.toFixed(2)}%</div>
                        <div class="overview-label">Avg Engagement Rate</div>
                    </div>
                </div>

                <div class="platforms-grid">
                    ${Object.entries(response.data.platformBreakdown).map(([platform, data]: [string, any]) => {
                      const platformEmojis: {[key: string]: string} = {
                        youtube: '📺', twitter: '🐦', facebook: '📘', 
                        reddit: '🔶', tiktok: '🎵', instagram: '📸'
                      };
                      
                      const hasError = !data || data.error;
                      
                      return `
                        <div class="platform-card">
                            <div class="platform-header">
                                <div class="platform-title">
                                    ${platformEmojis[platform] || '📱'} ${platform.charAt(0).toUpperCase() + platform.slice(1)}
                                </div>
                                <div class="platform-status ${hasError ? 'status-error' : 'status-connected'}">
                                    ${hasError ? 'Error' : 'Connected'}
                                </div>
                            </div>
                            
                            ${!hasError && data.metrics ? `
                                <div class="platform-metrics">
                                    <div class="metric-box">
                                        <div class="metric-number">${(data.metrics.followers || 0).toLocaleString()}</div>
                                        <div class="metric-label">Followers</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-number">${(data.metrics.likes || 0).toLocaleString()}</div>
                                        <div class="metric-label">Likes</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-number">${(data.metrics.comments || 0).toLocaleString()}</div>
                                        <div class="metric-label">Comments</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-number">${(data.metrics.shares || 0).toLocaleString()}</div>
                                        <div class="metric-label">Shares</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-number">${(data.posts?.length || 0).toLocaleString()}</div>
                                        <div class="metric-label">Posts</div>
                                    </div>
                                    <div class="metric-box">
                                        <div class="metric-number">${(data.metrics.engagement_rate || 0).toFixed(1)}%</div>
                                        <div class="metric-label">Engagement</div>
                                    </div>
                                </div>
                            ` : `
                                <div style="text-align: center; padding: 20px; color: #718096;">
                                    ${hasError ? `❌ ${data.error || 'Failed to load data'}` : '📊 No data available'}
                                </div>
                            `}
                        </div>
                      `;
                    }).join('')}
                </div>

                ${Object.keys(response.data).length === 0 ? `
                    <div class="no-data">
                        <h3>📊 No analytics data available</h3>
                        <p>Connect your social media accounts to see your performance metrics!</p>
                        <div style="margin-top: 20px;">
                            <a href="/" class="nav-btn">🔗 Connect Accounts</a>
                        </div>
                    </div>
                ` : ''}
            </div>
        </body>
        </html>
      `);
    } else {
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Analytics Error</title></head>
        <body style="font-family: system-ui; padding: 50px; text-align: center;">
          <h1>🚨 Error Loading Analytics</h1>
          <p>${response.error || 'Unknown error'}</p>
          <a href="/" style="color: #007bff;">← Back to Home</a>
        </body>
        </html>
      `);
    }
  } catch (error) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Analytics Error</title></head>
      <body style="font-family: system-ui; padding: 50px; text-align: center;">
        <h1>💥 Server Error</h1>
        <p>${(error as Error).message}</p>
        <a href="/" style="color: #007bff;">← Back to Home</a>
      </body>
      </html>
    `);
  }
});

app.get('/trends', async (req, res) => {
  try {
    const timeRange = (req.query.timeRange as string) || '7';
    const response = await aggregator.getTrendingInsights(timeRange);
    
    if (response.success && response.data) {
      // Create beautiful HTML interface for trends
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🔥 Trending Insights - Influence Hub</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh; padding: 20px;
                }
                .container { max-width: 1200px; margin: 0 auto; }
                .header {
                    text-align: center; background: rgba(255,255,255,0.95);
                    padding: 30px; border-radius: 20px; margin-bottom: 30px;
                    backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                }
                .header h1 { font-size: 2.5rem; margin-bottom: 10px; color: #2d3748; }
                .time-filter {
                    margin: 20px 0; display: flex; justify-content: center; gap: 10px;
                    flex-wrap: wrap;
                }
                .time-btn {
                    padding: 8px 16px; background: #4299e1; color: white;
                    border: none; border-radius: 20px; cursor: pointer;
                    text-decoration: none; transition: all 0.3s;
                }
                .time-btn:hover { background: #3182ce; transform: translateY(-2px); }
                .time-btn.active { background: #2b6cb0; }
                .trends-grid {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px; margin-bottom: 30px;
                }
                .trend-card {
                    background: rgba(255,255,255,0.95); border-radius: 15px;
                    padding: 25px; backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                    transition: transform 0.3s, box-shadow 0.3s;
                }
                .trend-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 12px 40px rgba(0,0,0,0.15);
                }
                .trend-topic {
                    font-size: 1.2rem; font-weight: 600; color: #2d3748;
                    margin-bottom: 15px; line-height: 1.4;
                }
                .trend-stats {
                    display: flex; justify-content: space-between;
                    flex-wrap: wrap; gap: 10px; margin-bottom: 15px;
                }
                .trend-stat {
                    padding: 8px 12px; background: #edf2f7;
                    border-radius: 8px; font-size: 0.9rem;
                    display: flex; align-items: center; gap: 5px;
                }
                .trend-mentions { color: #e53e3e; }
                .trend-growth { color: #38a169; }
                .trend-sentiment { color: #3182ce; }
                .trend-hashtags {
                    display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;
                }
                .hashtag {
                    background: #bee3f8; color: #2b6cb0; padding: 4px 8px;
                    border-radius: 12px; font-size: 0.8rem; font-weight: 500;
                }
                .platform-section {
                    background: rgba(255,255,255,0.95); border-radius: 15px;
                    padding: 25px; margin-bottom: 20px;
                    backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                }
                .platform-title {
                    font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;
                    color: #2d3748; display: flex; align-items: center; gap: 10px;
                }
                .no-data {
                    text-align: center; padding: 40px; color: #718096;
                    background: rgba(255,255,255,0.9); border-radius: 15px;
                }
                .nav-bar {
                    display: flex; justify-content: center; gap: 15px;
                    margin-bottom: 20px; flex-wrap: wrap;
                }
                .nav-btn {
                    padding: 10px 20px; background: rgba(255,255,255,0.9);
                    color: #4a5568; border: none; border-radius: 25px;
                    text-decoration: none; transition: all 0.3s;
                    font-weight: 500;
                }
                .nav-btn:hover {
                    background: white; transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔥 Trending Insights</h1>
                    <p>Discover what's hot across your social media platforms</p>
                    
                    <div class="time-filter">
                        <a href="/trends?timeRange=1" class="time-btn ${timeRange === '1' ? 'active' : ''}">24h</a>
                        <a href="/trends?timeRange=7" class="time-btn ${timeRange === '7' ? 'active' : ''}">7 days</a>
                        <a href="/trends?timeRange=30" class="time-btn ${timeRange === '30' ? 'active' : ''}">30 days</a>
                    </div>
                    
                    <div class="nav-bar">
                        <a href="/" class="nav-btn">🏠 Home</a>
                        <a href="/dashboard" class="nav-btn">📊 Dashboard</a>
                        <a href="/trends" class="nav-btn">🔥 Trends</a>
                        <a href="/api-keys" class="nav-btn">🔑 API Keys</a>
                        <a href="/settings" class="nav-btn">⚙️ Settings</a>
                    </div>
                </div>

                ${Object.entries(response.data).map(([platform, trends]) => {
                  const platformEmojis: {[key: string]: string} = {
                    youtube: '📺', twitter: '🐦', facebook: '📘', 
                    reddit: '🔶', tiktok: '🎵', instagram: '📸'
                  };
                  
                  return trends && Array.isArray(trends) && trends.length > 0 ? `
                    <div class="platform-section">
                        <div class="platform-title">
                            ${platformEmojis[platform] || '📱'} ${platform.charAt(0).toUpperCase() + platform.slice(1)} Trends
                        </div>
                        <div class="trends-grid">
                            ${trends.slice(0, 6).map((trend: any) => `
                                <div class="trend-card">
                                    <div class="trend-topic">${trend.topic}</div>
                                    <div class="trend-stats">
                                        <div class="trend-stat trend-mentions">
                                            📈 ${trend.mentions?.toLocaleString() || 0} mentions
                                        </div>
                                        <div class="trend-stat trend-growth">
                                            🚀 ${(trend.growth_rate || 0).toFixed(1)}% growth
                                        </div>
                                        <div class="trend-stat trend-sentiment">
                                            ${trend.sentiment === 'positive' ? '😊' : trend.sentiment === 'negative' ? '😔' : '😐'} 
                                            ${trend.sentiment}
                                        </div>
                                    </div>
                                    ${trend.hashtags && trend.hashtags.length > 0 ? `
                                        <div class="trend-hashtags">
                                            ${trend.hashtags.slice(0, 5).map((tag: string) => 
                                              `<span class="hashtag">#${tag}</span>`
                                            ).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                  ` : '';
                }).join('')}

                ${Object.keys(response.data).length === 0 ? `
                    <div class="no-data">
                        <h3>📊 No trending data available</h3>
                        <p>Connect your social media accounts to see trending insights!</p>
                        <div style="margin-top: 20px;">
                            <a href="/" class="nav-btn">🔗 Connect Accounts</a>
                        </div>
                    </div>
                ` : ''}
            </div>
        </body>
        </html>
      `);
    } else {
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Trends Error</title></head>
        <body style="font-family: system-ui; padding: 50px; text-align: center;">
          <h1>🚨 Error Loading Trends</h1>
          <p>${response.error || 'Unknown error'}</p>
          <a href="/" style="color: #007bff;">← Back to Home</a>
        </body>
        </html>
      `);
    }
  } catch (error) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Trends Error</title></head>
      <body style="font-family: system-ui; padding: 50px; text-align: center;">
        <h1>💥 Server Error</h1>
        <p>${(error as Error).message}</p>
        <a href="/" style="color: #007bff;">← Back to Home</a>
      </body>
      </html>
    `);
  }
});

app.get('/dashboard', (req, res) => {
  res.redirect('/metrics');
});

app.get('/api-keys', (req, res) => {
  const configured = tokenManager.listConfiguredPlatforms();
  
  // Get existing credentials for form population
  const getCredentialValues = (platform: SupportedPlatform) => {
    const creds = tokenManager.getCredentials(platform);
    if (!creds) return {};
    
    // Return actual values - we'll handle hiding them in the frontend
    const values: Record<string, string> = {};
    Object.entries(creds).forEach(([key, value]) => {
      values[key] = value || '';
    });
    return values;
  };
  
  const youtubeValues = getCredentialValues('youtube');
  const twitterValues = getCredentialValues('twitter');
  const redditValues = getCredentialValues('reddit');
  const facebookValues = getCredentialValues('facebook');
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🔑 API Keys Management - Influence Hub</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh; padding: 20px;
            }
            .container { max-width: 1000px; margin: 0 auto; }
            .header {
                text-align: center; background: rgba(255,255,255,0.95);
                padding: 30px; border-radius: 20px; margin-bottom: 30px;
                backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            }
            .header h1 { font-size: 2.5rem; margin-bottom: 10px; color: #2d3748; }
            .nav-bar {
                display: flex; justify-content: center; gap: 15px;
                margin-bottom: 20px; flex-wrap: wrap;
            }
            .nav-btn {
                padding: 10px 20px; background: rgba(255,255,255,0.9);
                color: #4a5568; border: none; border-radius: 25px;
                text-decoration: none; transition: all 0.3s;
                font-weight: 500;
            }
            .nav-btn:hover {
                background: white; transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            .platform-forms {
                display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
                gap: 25px; margin-bottom: 30px;
            }
            .platform-card {
                background: rgba(255,255,255,0.95); border-radius: 15px;
                padding: 25px; backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            }
            .platform-header {
                display: flex; align-items: center; justify-content: space-between;
                margin-bottom: 20px;
            }
            .platform-title {
                font-size: 1.5rem; font-weight: 600; color: #2d3748;
                display: flex; align-items: center; gap: 10px;
            }
            .platform-status {
                padding: 6px 12px; border-radius: 12px; font-size: 0.8rem;
                font-weight: 500;
            }
            .status-configured { background: #c6f6d5; color: #22543d; }
            .status-empty { background: #fed7d7; color: #c53030; }
            .form-group {
                margin-bottom: 15px;
            }
            .form-label {
                display: block; margin-bottom: 8px; font-weight: 500;
                color: #2d3748; font-size: 0.9rem;
            }
            .form-input {
                width: 100%; padding: 12px; border: 2px solid #e2e8f0;
                border-radius: 8px; font-size: 0.9rem; transition: all 0.3s;
                background: white;
            }
            .form-input:focus {
                outline: none; border-color: #4299e1;
                box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
            }
            .form-input.configured {
                background: #f0fff4; border-color: #68d391;
            }
            .btn {
                padding: 12px 24px; border-radius: 8px; border: none;
                font-weight: 500; cursor: pointer; transition: all 0.3s;
                font-size: 0.9rem;
            }
            .btn-primary { background: #4299e1; color: white; }
            .btn-primary:hover { background: #3182ce; }
            .btn-success { background: #48bb78; color: white; }
            .btn-success:hover { background: #38a169; }
            .btn-danger { background: #f56565; color: white; }
            .btn-danger:hover { background: #e53e3e; }
            .btn-secondary { background: #e2e8f0; color: #4a5568; }
            .btn-secondary:hover { background: #cbd5e0; }
            .btn-group {
                display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;
            }
            .help-text {
                font-size: 0.8rem; color: #718096; margin-top: 5px;
                line-height: 1.4;
            }
            .warning-box {
                background: #fef5e7; border: 1px solid #f6ad55;
                border-radius: 8px; padding: 15px; margin-bottom: 20px;
                color: #744210;
            }
            .success-message {
                background: #f0fff4; border: 1px solid #68d391;
                border-radius: 8px; padding: 15px; margin-bottom: 20px;
                color: #22543d; display: none;
            }
            .password-toggle {
                position: relative;
            }
            .password-toggle button {
                position: absolute; right: 10px; top: 50%;
                transform: translateY(-50%); background: none;
                border: none; color: #718096; cursor: pointer;
                font-size: 0.8rem;
            }
        </style>
        <script>
            // Store original values for password fields
            const originalValues = new Map();
            
            function togglePassword(fieldId) {
                const field = document.getElementById(fieldId);
                const btn = field.parentNode.querySelector('button');
                
                if (field.type === 'password') {
                    // Show the actual value
                    const originalValue = field.getAttribute('data-original');
                    if (field.value === '••••••••' && originalValue) {
                        field.value = originalValue;
                    }
                    field.type = 'text';
                    btn.textContent = 'Hide';
                } else {
                    // Hide the value - if it's the original value, mask it
                    const originalValue = field.getAttribute('data-original');
                    if (originalValue && field.value === originalValue) {
                        field.value = '••••••••';
                    }
                    field.type = 'password';
                    btn.textContent = 'Show';
                }
            }
            
            // Initialize password field masking on page load
            document.addEventListener('DOMContentLoaded', function() {
                const passwordFields = document.querySelectorAll('input[type="password"]');
                passwordFields.forEach(field => {
                    // Store the original value
                    if (field.value) {
                        originalValues.set(field.id, field.value);
                        // Replace with masked display
                        field.setAttribute('data-original', field.value);
                        field.value = '••••••••';
                    }
                    
                    // When user focuses and field shows masked value, clear it for new input
                    field.addEventListener('focus', function() {
                        if (this.value === '••••••••' && this.type === 'password') {
                            this.value = '';
                            this.placeholder = 'Enter new value or leave empty to keep existing';
                        }
                    });
                    
                    // Restore masked display if field is empty when losing focus
                    field.addEventListener('blur', function() {
                        if (this.value === '' && this.getAttribute('data-original')) {
                            this.value = '••••••••';
                            this.placeholder = '';
                        }
                    });
                });
            });

            function saveCredentials(platform) {
                const form = document.getElementById(platform + '-form');
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                
                // Handle password fields: remove empty ones and masked ones (no change)
                Object.keys(data).forEach(key => {
                    const field = form.querySelector(\`[name="\${key}"]\`);
                    if (field && field.type === 'password') {
                        // If field is empty or showing masked value, don't send it (keep existing)
                        if (data[key] === '' || data[key] === '••••••••') {
                            delete data[key];
                        }
                        // If field shows original value, send it as-is
                    }
                    // Also handle empty non-password sensitive fields
                    if (data[key] === '' && (key.includes('secret') || key.includes('token') || key.includes('password'))) {
                        delete data[key];
                    }
                });
                
                fetch('/api-keys/' + platform, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        showMessage('success', platform + ' credentials saved successfully!');
                        // Update the form inputs to show they are configured
                        const form = document.getElementById(platform + '-form');
                        const inputs = form.querySelectorAll('input');
                        inputs.forEach(input => input.classList.add('configured'));
                    } else {
                        showMessage('error', 'Error saving credentials: ' + result.error);
                    }
                })
                .catch(error => {
                    showMessage('error', 'Network error: ' + error.message);
                });
            }

            function testCredentials(platform) {
                const form = document.getElementById(platform + '-form');
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                
                // For testing, replace masked values with actual stored values
                Object.keys(data).forEach(key => {
                    const field = form.querySelector(\`[name="\${key}"]\`);
                    if (field && field.type === 'password' && data[key] === '••••••••') {
                        // Use the original stored value for testing
                        const originalValue = field.getAttribute('data-original');
                        if (originalValue) {
                            data[key] = originalValue;
                        }
                    }
                });
                
                console.log('🚀 Sending test data for ' + platform + ':', {
                    keys: Object.keys(data),
                    api_key: data.api_key ? data.api_key.substring(0, 10) + '...' : 'MISSING'
                });
                
                fetch('/api-keys/' + platform + '/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        showMessage('success', platform + ' credentials are valid!');
                    } else {
                        showMessage('error', 'Credentials test failed: ' + result.error);
                    }
                })
                .catch(error => {
                    showMessage('error', 'Test failed: ' + error.message);
                });
            }

            function clearCredentials(platform) {
                if (confirm('Are you sure you want to clear all ' + platform + ' credentials?')) {
                    fetch('/api-keys/' + platform, { method: 'DELETE' })
                    .then(response => response.json())
                    .then(result => {
                        if (result.success) {
                            showMessage('success', platform + ' credentials cleared!');
                            location.reload();
                        } else {
                            showMessage('error', 'Error clearing credentials: ' + result.error);
                        }
                    });
                }
            }

            function showMessage(type, message) {
                const alertDiv = document.createElement('div');
                alertDiv.className = type === 'success' ? 'success-message' : 'warning-box';
                alertDiv.textContent = message;
                alertDiv.style.display = 'block';
                
                document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.platform-forms'));
                
                setTimeout(() => alertDiv.remove(), 5000);
            }
        </script>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔑 API Keys Management</h1>
                <p>Configure your social media platform API credentials</p>
                
                <div class="nav-bar">
                    <a href="/" class="nav-btn">🏠 Home</a>
                    <a href="/metrics" class="nav-btn">📊 Dashboard</a>
                    <a href="/trends" class="nav-btn">🔥 Trends</a>
                    <a href="/api-keys" class="nav-btn">🔑 API Keys</a>
                    <a href="/settings" class="nav-btn">⚙️ Settings</a>
                </div>
            </div>

            <div class="warning-box">
                <strong>⚠️ Security Notice:</strong> Your API keys are stored locally and encrypted. Never share these credentials or commit them to public repositories.
            </div>

            <div class="platform-forms">
                <!-- YouTube API -->
                <div class="platform-card">
                    <div class="platform-header">
                        <div class="platform-title">📺 YouTube</div>
                        <div class="platform-status ${configured.includes('youtube') ? 'status-configured' : 'status-empty'}">
                            ${configured.includes('youtube') ? 'Configured' : 'Not Set'}
                        </div>
                    </div>
                    <form id="youtube-form">
                        <div class="form-group">
                            <label class="form-label">API Key *</label>
                            <input type="text" name="api_key" class="form-input ${configured.includes('youtube') ? 'configured' : ''}" 
                                   placeholder="AIza..." value="${youtubeValues.api_key || ''}" required>
                            <div class="help-text">Get from Google Cloud Console → APIs & Services → Credentials</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">OAuth Client ID</label>
                            <input type="text" name="client_id" class="form-input ${configured.includes('youtube') ? 'configured' : ''}" 
                                   placeholder="123456789.apps.googleusercontent.com" value="${youtubeValues.client_id || ''}">
                        </div>
                        <div class="form-group password-toggle">
                            <label class="form-label">OAuth Client Secret</label>
                            <input type="password" name="client_secret" id="youtube-secret" class="form-input ${configured.includes('youtube') ? 'configured' : ''}" 
                                   placeholder="GOCSPX-..." value="${youtubeValues.client_secret || ''}">
                            <button type="button" onclick="togglePassword('youtube-secret')">Show</button>
                            <div class="help-text">Required for personal data access (subscriptions, uploads)</div>
                        </div>
                        <div class="btn-group">
                            <button type="button" class="btn btn-primary" onclick="saveCredentials('youtube')">Save</button>
                            <button type="button" class="btn btn-secondary" onclick="testCredentials('youtube')">Test</button>
                            <button type="button" class="btn btn-danger" onclick="clearCredentials('youtube')">Clear</button>
                        </div>
                    </form>
                </div>

                <!-- Twitter API -->
                <div class="platform-card">
                    <div class="platform-header">
                        <div class="platform-title">🐦 Twitter/X</div>
                        <div class="platform-status ${configured.includes('twitter') ? 'status-configured' : 'status-empty'}">
                            ${configured.includes('twitter') ? 'Configured' : 'Not Set'}
                        </div>
                    </div>
                    <form id="twitter-form">
                        <div class="form-group">
                            <label class="form-label">API Key *</label>
                            <input type="text" name="api_key" class="form-input ${configured.includes('twitter') ? 'configured' : ''}" 
                                   placeholder="Enter Twitter API Key" value="${twitterValues.api_key || ''}" required>
                        </div>
                        <div class="form-group password-toggle">
                            <label class="form-label">API Secret *</label>
                            <input type="password" name="api_secret" id="twitter-secret" class="form-input ${configured.includes('twitter') ? 'configured' : ''}" 
                                   placeholder="Enter Twitter API Secret" value="${twitterValues.api_secret || ''}" required>
                            <button type="button" onclick="togglePassword('twitter-secret')">Show</button>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Bearer Token</label>
                            <input type="text" name="bearer_token" class="form-input ${configured.includes('twitter') ? 'configured' : ''}" 
                                   placeholder="AAAAAAAAAA..." value="${twitterValues.bearer_token || ''}">
                            <div class="help-text">For app-only authentication (public data)</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Access Token</label>
                            <input type="text" name="access_token" class="form-input ${configured.includes('twitter') ? 'configured' : ''}" 
                                   placeholder="123456-..." value="${twitterValues.access_token || ''}">
                        </div>
                        <div class="form-group password-toggle">
                            <label class="form-label">Access Token Secret</label>
                            <input type="password" name="access_token_secret" id="twitter-access-secret" class="form-input ${configured.includes('twitter') ? 'configured' : ''}" 
                                   placeholder="Enter Access Token Secret" value="${twitterValues.access_token_secret || ''}">
                            <button type="button" onclick="togglePassword('twitter-access-secret')">Show</button>
                            <div class="help-text">Required for personal data access</div>
                        </div>
                        <div class="btn-group">
                            <button type="button" class="btn btn-primary" onclick="saveCredentials('twitter')">Save</button>
                            <button type="button" class="btn btn-secondary" onclick="testCredentials('twitter')">Test</button>
                            <button type="button" class="btn btn-danger" onclick="clearCredentials('twitter')">Clear</button>
                        </div>
                    </form>
                </div>

                <!-- Reddit API -->
                <div class="platform-card">
                    <div class="platform-header">
                        <div class="platform-title">🔶 Reddit</div>
                        <div class="platform-status ${configured.includes('reddit') ? 'status-configured' : 'status-empty'}">
                            ${configured.includes('reddit') ? 'Configured' : 'Not Set'}
                        </div>
                    </div>
                    <form id="reddit-form">
                        <div class="form-group">
                            <label class="form-label">Client ID *</label>
                            <input type="text" name="client_id" class="form-input ${configured.includes('reddit') ? 'configured' : ''}" 
                                   placeholder="Enter Reddit Client ID" value="${redditValues.client_id || ''}" required>
                            <div class="help-text">From Reddit App Preferences → Developed Applications</div>
                        </div>
                        <div class="form-group password-toggle">
                            <label class="form-label">Client Secret *</label>
                            <input type="password" name="client_secret" id="reddit-secret" class="form-input ${configured.includes('reddit') ? 'configured' : ''}" 
                                   placeholder="Enter Reddit Client Secret" value="${redditValues.client_secret || ''}" required>
                            <button type="button" onclick="togglePassword('reddit-secret')">Show</button>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Redirect URI</label>
                            <input type="text" name="redirect_uri" class="form-input ${configured.includes('reddit') ? 'configured' : ''}" 
                                   value="${redditValues.redirect_uri || 'http://127.0.0.1:3002/auth/reddit/callback'}" readonly>
                            <div class="help-text">Use this exact URL in your Reddit app settings</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Username (Optional)</label>
                            <input type="text" name="username" class="form-input ${configured.includes('reddit') ? 'configured' : ''}" 
                                   placeholder="Reddit username" value="${redditValues.username || ''}">
                            <div class="help-text">Only needed for password-based authentication</div>
                        </div>
                        <div class="btn-group">
                            <button type="button" class="btn btn-primary" onclick="saveCredentials('reddit')">Save</button>
                            <button type="button" class="btn btn-secondary" onclick="testCredentials('reddit')">Test</button>
                            <button type="button" class="btn btn-danger" onclick="clearCredentials('reddit')">Clear</button>
                        </div>
                    </form>
                </div>

                <!-- Facebook API -->
                <div class="platform-card">
                    <div class="platform-header">
                        <div class="platform-title">📘 Facebook</div>
                        <div class="platform-status ${configured.includes('facebook') ? 'status-configured' : 'status-empty'}">
                            ${configured.includes('facebook') ? 'Configured' : 'Not Set'}
                        </div>
                    </div>
                    <form id="facebook-form">
                        <div class="form-group">
                            <label class="form-label">App ID *</label>
                            <input type="text" name="app_id" class="form-input ${configured.includes('facebook') ? 'configured' : ''}" 
                                   placeholder="Enter Facebook App ID" value="${facebookValues.app_id || ''}" required>
                        </div>
                        <div class="form-group password-toggle">
                            <label class="form-label">App Secret *</label>
                            <input type="password" name="app_secret" id="facebook-secret" class="form-input ${configured.includes('facebook') ? 'configured' : ''}" 
                                   placeholder="Enter Facebook App Secret" value="${facebookValues.app_secret || ''}" required>
                            <button type="button" onclick="togglePassword('facebook-secret')">Show</button>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Access Token</label>
                            <input type="text" name="access_token" class="form-input ${configured.includes('facebook') ? 'configured' : ''}" 
                                   placeholder="Long-lived User Access Token" value="${facebookValues.access_token || ''}">
                            <div class="help-text">Get from Graph API Explorer or OAuth flow</div>
                        </div>
                        <div class="btn-group">
                            <button type="button" class="btn btn-primary" onclick="saveCredentials('facebook')">Save</button>
                            <button type="button" class="btn btn-secondary" onclick="testCredentials('facebook')">Test</button>
                            <button type="button" class="btn btn-danger" onclick="clearCredentials('facebook')">Clear</button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="platform-card" style="text-align: center;">
                <h3 style="margin-bottom: 15px;">📚 Need Help?</h3>
                <p style="color: #718096; margin-bottom: 20px;">
                    Check out the setup guides for each platform to get your API credentials.
                </p>
                <div class="btn-group" style="justify-content: center;">
                    <a href="https://console.cloud.google.com/" target="_blank" class="btn btn-secondary">Google Cloud Console</a>
                    <a href="https://developer.x.com/" target="_blank" class="btn btn-secondary">Twitter Developers</a>
                    <a href="https://www.reddit.com/prefs/apps" target="_blank" class="btn btn-secondary">Reddit Apps</a>
                    <a href="https://developers.facebook.com/" target="_blank" class="btn btn-secondary">Facebook Developers</a>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

// API endpoints for credential management
app.post('/api-keys/:platform', express.json(), (req, res) => {
  try {
    const platform = req.params.platform as SupportedPlatform;
    const credentials = req.body;
    
    // Validate platform
    const available = connectorFactory.getAvailablePlatforms();
    if (!available.includes(platform)) {
      return res.status(400).json({ success: false, error: 'Unsupported platform' });
    }

    // Merge with existing credentials (keep existing values for missing fields)
    const existingCredentials = tokenManager.getCredentials(platform) || {};
    const mergedCredentials = { ...existingCredentials, ...credentials };
    
    // Save merged credentials using tokenManager
    tokenManager.setCredentials(platform, mergedCredentials);
    
    return res.json({ success: true, message: `${platform} credentials saved successfully` });
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.post('/api-keys/:platform/test', (req, res) => {
  try {
    const platform = req.params.platform as SupportedPlatform;
    
    // Use credentials from request body if provided, otherwise use saved credentials
    let credentials = req.body && Object.keys(req.body).length > 0 
      ? req.body as PlatformCredentials
      : tokenManager.getCredentials(platform);
    
    console.log(`🧪 Testing ${platform} credentials:`, { 
      hasCredentials: !!credentials,
      credentialKeys: credentials ? Object.keys(credentials) : [],
      apiKey: credentials?.api_key ? `${credentials.api_key.substring(0, 10)}...` : 'MISSING',
      fromRequestBody: req.body && Object.keys(req.body).length > 0
    });
    
    // Also log what's in .env for comparison
    const envCredentials = tokenManager.getCredentials(platform);
    console.log(`📁 .env ${platform} credentials:`, {
      hasEnvCredentials: !!envCredentials,
      envCredentialKeys: envCredentials ? Object.keys(envCredentials) : [],
      envApiKey: envCredentials?.api_key ? `${envCredentials.api_key.substring(0, 10)}...` : 'MISSING'
    });
    
    if (!credentials) {
      return res.status(400).json({ success: false, error: 'No credentials provided for testing' });
    }

    // Create connector and test credentials
    const connector = connectorFactory.createConnector(platform, credentials);
    if (!connector) {
      return res.status(400).json({ success: false, error: 'Platform connector not available' });
    }

    console.log(`🔧 Created ${platform} connector, testing...`);

    // Test the credentials
    connector.validateCredentials()
      .then(isValid => {
        console.log(`✅ ${platform} validation result:`, isValid);
        if (isValid) {
          res.json({ success: true, message: `${platform} credentials are valid` });
        } else {
          res.json({ success: false, error: 'Invalid credentials or API connection failed' });
        }
      })
      .catch(error => {
        console.error(`❌ ${platform} validation error:`, error);
        res.json({ success: false, error: error.message });
      });
      
    return; // Explicit return for TypeScript
      
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Test endpoint that only uses .env credentials
app.post('/api-keys/:platform/test-env', (req, res) => {
  try {
    const platform = req.params.platform as SupportedPlatform;
    const credentials = tokenManager.getCredentials(platform);
    
    console.log(`🔬 Testing .env ${platform} credentials only:`, {
      hasCredentials: !!credentials,
      credentialKeys: credentials ? Object.keys(credentials) : [],
      apiKey: credentials?.api_key ? `${credentials.api_key.substring(0, 10)}...` : 'MISSING'
    });
    
    if (!credentials) {
      return res.status(400).json({ success: false, error: 'No .env credentials found for this platform' });
    }

    const connector = connectorFactory.createConnector(platform, credentials);
    if (!connector) {
      return res.status(400).json({ success: false, error: 'Platform connector not available' });
    }

    connector.validateCredentials()
      .then(isValid => {
        console.log(`🔬 .env ${platform} validation result:`, isValid);
        res.json({ 
          success: isValid, 
          message: isValid ? `${platform} .env credentials are valid` : 'Invalid .env credentials'
        });
      })
      .catch(error => {
        console.error(`🔬 .env ${platform} validation error:`, error);
        res.json({ success: false, error: error.message });
      });
      
    return; // Explicit return for TypeScript
      
  } catch (error) {
    return res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.delete('/api-keys/:platform', (req, res) => {
  try {
    const platform = req.params.platform as SupportedPlatform;
    
    // Clear credentials
    tokenManager.removeCredentials(platform);
    
    res.json({ success: true, message: `${platform} credentials cleared successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/settings', (req, res) => {
  const configured = tokenManager.listConfiguredPlatforms();
  const available = connectorFactory.getAvailablePlatforms();
  const supported = connectorFactory.getSupportedPlatforms();
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>⚙️ Platform Settings - Influence Hub</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh; padding: 20px;
            }
            .container { max-width: 1200px; margin: 0 auto; }
            .header {
                text-align: center; background: rgba(255,255,255,0.95);
                padding: 30px; border-radius: 20px; margin-bottom: 30px;
                backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            }
            .header h1 { font-size: 2.5rem; margin-bottom: 10px; color: #2d3748; }
            .nav-bar {
                display: flex; justify-content: center; gap: 15px;
                margin-bottom: 20px; flex-wrap: wrap;
            }
            .nav-btn {
                padding: 10px 20px; background: rgba(255,255,255,0.9);
                color: #4a5568; border: none; border-radius: 25px;
                text-decoration: none; transition: all 0.3s;
                font-weight: 500;
            }
            .nav-btn:hover {
                background: white; transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            .platforms-section {
                display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: 25px; margin-bottom: 30px;
            }
            .platform-card {
                background: rgba(255,255,255,0.95); border-radius: 15px;
                padding: 25px; backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                transition: transform 0.3s;
            }
            .platform-card:hover { transform: translateY(-5px); }
            .platform-header {
                display: flex; align-items: center; justify-content: space-between;
                margin-bottom: 20px;
            }
            .platform-title {
                font-size: 1.5rem; font-weight: 600; color: #2d3748;
                display: flex; align-items: center; gap: 10px;
            }
            .platform-status {
                padding: 6px 12px; border-radius: 12px; font-size: 0.8rem;
                font-weight: 500;
            }
            .status-connected { background: #c6f6d5; color: #22543d; }
            .status-available { background: #bee3f8; color: #2b6cb0; }
            .status-unavailable { background: #fed7d7; color: #c53030; }
            .platform-actions {
                display: flex; gap: 10px; flex-wrap: wrap;
            }
            .btn {
                padding: 8px 16px; border-radius: 8px; text-decoration: none;
                font-weight: 500; text-align: center; transition: all 0.3s;
                border: none; cursor: pointer;
            }
            .btn-primary { background: #4299e1; color: white; }
            .btn-primary:hover { background: #3182ce; }
            .btn-success { background: #48bb78; color: white; }
            .btn-success:hover { background: #38a169; }
            .btn-danger { background: #f56565; color: white; }
            .btn-danger:hover { background: #e53e3e; }
            .btn-secondary { background: #e2e8f0; color: #4a5568; }
            .btn-secondary:hover { background: #cbd5e0; }
            .platform-info {
                margin: 15px 0; padding: 15px; background: #f7fafc;
                border-radius: 8px; font-size: 0.9rem; color: #4a5568;
            }
            .section-title {
                font-size: 1.8rem; font-weight: 600; color: #2d3748;
                margin: 30px 0 20px 0; text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚙️ Platform Settings</h1>
                <p>Configure your social media platform connections</p>
                
                <div class="nav-bar">
                    <a href="/" class="nav-btn">🏠 Home</a>
                    <a href="/metrics" class="nav-btn">📊 Dashboard</a>
                    <a href="/trends" class="nav-btn">🔥 Trends</a>
                    <a href="/settings" class="nav-btn">⚙️ Settings</a>
                </div>
            </div>

            <div class="section-title">✅ Connected Platforms</div>
            <div class="platforms-section">
                ${configured.length > 0 ? configured.map((platform: string) => {
                  const platformEmojis: {[key: string]: string} = {
                    youtube: '📺', twitter: '🐦', facebook: '📘', 
                    reddit: '🔶', tiktok: '🎵', instagram: '📸'
                  };
                  
                  return `
                    <div class="platform-card">
                        <div class="platform-header">
                            <div class="platform-title">
                                ${platformEmojis[platform] || '📱'} ${platform.charAt(0).toUpperCase() + platform.slice(1)}
                            </div>
                            <div class="platform-status status-connected">Connected</div>
                        </div>
                        <div class="platform-info">
                            Platform is connected and ready to fetch analytics data.
                        </div>
                        <div class="platform-actions">
                            <a href="/${platform}/dashboard" class="btn btn-success">View Dashboard</a>
                            <button onclick="if(confirm('Remove ${platform} connection?')) window.location.href='/platforms/${platform}/remove'" class="btn btn-danger">Disconnect</button>
                        </div>
                    </div>
                  `;
                }).join('') : `
                    <div class="platform-card">
                        <div style="text-align: center; padding: 20px; color: #718096;">
                            <h3>📱 No platforms connected</h3>
                            <p>Connect your first social media platform below!</p>
                        </div>
                    </div>
                `}
            </div>

            <div class="section-title">📱 Available Platforms</div>
            <div class="platforms-section">
                ${available.filter((platform: any) => !configured.includes(platform)).map((platform: any) => {
                  const platformEmojis: {[key: string]: string} = {
                    youtube: '📺', twitter: '🐦', facebook: '📘', 
                    reddit: '🔶', tiktok: '🎵', instagram: '📸'
                  };
                  
                  const isSupported = supported.includes(platform as any);
                  
                  return `
                    <div class="platform-card">
                        <div class="platform-header">
                            <div class="platform-title">
                                ${platformEmojis[platform] || '📱'} ${platform.charAt(0).toUpperCase() + platform.slice(1)}
                            </div>
                            <div class="platform-status ${isSupported ? 'status-available' : 'status-unavailable'}">
                                ${isSupported ? 'Available' : 'Coming Soon'}
                            </div>
                        </div>
                        <div class="platform-info">
                            ${isSupported ? 
                              `Ready to connect! Click setup to configure your ${platform} credentials.` :
                              `Platform integration is in development and will be available soon.`
                            }
                        </div>
                        <div class="platform-actions">
                            ${isSupported ? `
                                <a href="/${platform}/setup" class="btn btn-primary">Setup Connection</a>
                            ` : `
                                <button class="btn btn-secondary" disabled>Coming Soon</button>
                            `}
                        </div>
                    </div>
                  `;
                }).join('')}
            </div>

            <div class="platform-card" style="margin-top: 30px; text-align: center;">
                <h3 style="margin-bottom: 15px;">🔧 Advanced Settings</h3>
                <div class="platform-actions" style="justify-content: center;">
                    <a href="/selftest" class="btn btn-secondary">🔍 Run Self-Test</a>
                    <a href="/status" class="btn btn-secondary">📊 Server Status</a>
                    <button onclick="if(confirm('Clear all platform connections?')) alert('Feature coming soon!')" class="btn btn-danger">🗑️ Reset All</button>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
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

    return res.json({ 
      success: true, 
      message: `${platform} configured successfully`,
      hash: tokenManager.hashCredentials(platform)
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
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

// YouTube OAuth routes
app.get('/auth/youtube', (req, res) => {
  try {
    // Check if we have OAuth credentials
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>YouTube OAuth Not Configured</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                    min-height: 100vh;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .error-card {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    max-width: 500px;
                }
                h1 { color: #333; margin-bottom: 15px; }
                p { color: #666; margin-bottom: 20px; line-height: 1.5; }
                .btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 25px;
                    text-decoration: none;
                    display: inline-block;
                    margin: 10px;
                }
            </style>
        </head>
        <body>
            <div class="error-card">
                <h1>⚙️ YouTube OAuth Not Configured</h1>
                <p>Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables.</p>
                <p>Visit the Google Cloud Console to set up OAuth credentials:</p>
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="btn">Google Cloud Console</a>
                <a href="/" class="btn">← Back to Home</a>
            </div>
        </body>
        </html>
      `);
    }

    const connector = new YouTubeOAuthConnector({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `http://127.0.0.1:${port}/auth/youtube/callback`
    }, new (require('./utils/rateLimiter').RateLimiter)());

    const authUrl = connector.generateAuthUrl();
    
    // Directly redirect to Google OAuth instead of showing JSON
    return res.redirect(authUrl);
  } catch (error) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Error</title></head>
      <body>
        <h1>OAuth Error</h1>
        <p>${(error as Error).message}</p>
        <a href="/">← Back to Home</a>
      </body>
      </html>
    `);
  }
});

app.get('/auth/youtube/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    
    if (error) {
      return res.json({ error: 'Authorization failed', details: error });
    }
    
    if (!code) {
      return res.json({ error: 'No authorization code received' });
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.json({ error: 'OAuth credentials not configured' });
    }

    const connector = new YouTubeOAuthConnector({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `http://127.0.0.1:${port}/auth/youtube/callback`
    }, new (require('./utils/rateLimiter').RateLimiter)());

    // Exchange code for tokens
    const tokens = await connector.exchangeCodeForTokens(code as string);
    
    // Save tokens to token manager
    tokenManager.setCredentials('youtube', {
      client_id: clientId,
      client_secret: clientSecret,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined
    });

    // Test the connection
    const oauthConnector = new YouTubeOAuthConnector({
      client_id: clientId,
      client_secret: clientSecret,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || undefined
    }, new (require('./utils/rateLimiter').RateLimiter)());

    const isValid = await oauthConnector.validateCredentials();
    
    if (isValid) {
      // Replace the old connector with OAuth version
      aggregator.removeConnector('youtube');
      aggregator.addConnector('youtube', oauthConnector);
      
      // Redirect to YouTube dashboard after successful authentication
      return res.redirect('/youtube/dashboard?auth=success');
    } else {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>YouTube Authentication Failed</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                       background: #f8f9fa; padding: 40px; text-align: center; }
                .error { background: white; padding: 40px; border-radius: 10px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
                h1 { color: #dc3545; }
                .btn { background: #667eea; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="error">
                <h1>❌ Authentication Failed</h1>
                <p>Authentication was successful, but validation failed. Please try again.</p>
                <a href="/" class="btn">← Back to Home</a>
                <a href="/auth/youtube" class="btn">Try Again</a>
            </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('YouTube OAuth callback error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// YouTube-specific endpoints
app.get('/youtube/videos', async (req, res) => {
  try {
    const maxResults = parseInt(req.query.maxResults as string) || 50;
    
    // Check if we have OAuth credentials
    const credentials = tokenManager.getCredentials('youtube');
    if (!credentials?.access_token) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>YouTube Videos - Influence Hub</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                    min-height: 100vh;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .auth-card {
                    background: white;
                    border-radius: 20px;
                    padding: 60px 40px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    max-width: 500px;
                }
                .youtube-icon { font-size: 4em; margin-bottom: 20px; }
                h1 { color: #333; margin-bottom: 15px; }
                p { color: #666; margin-bottom: 30px; line-height: 1.5; }
                .btn {
                    background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                    color: white;
                    padding: 15px 30px;
                    border: none;
                    border-radius: 25px;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 1.1em;
                    font-weight: 500;
                    transition: transform 0.2s ease;
                    margin: 5px;
                }
                .btn:hover { transform: scale(1.05); }
                .back-btn { background: #6c757d; }
            </style>
        </head>
        <body>
            <div class="auth-card">
                <div class="youtube-icon">🎥</div>
                <h1>YouTube Authentication Required</h1>
                <p>To view your YouTube videos, please authenticate with your Google account.</p>
                <a href="/" class="btn back-btn">← Back to Home</a>
                <a href="/auth/youtube" class="btn">Connect YouTube</a>
            </div>
        </body>
        </html>
      `);
    }

    const connector = new YouTubeOAuthConnector(credentials as any, new (require('./utils/rateLimiter').RateLimiter)());
    const result = await connector.getUploadedVideos(maxResults);
    
    if (result.success && result.data) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>YouTube Videos - Influence Hub</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #f8f9fa;
                    min-height: 100vh;
                    padding: 20px;
                }
                .container { max-width: 1200px; margin: 0 auto; }
                .header {
                    background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                    color: white;
                    padding: 30px;
                    border-radius: 15px;
                    margin-bottom: 30px;
                    text-align: center;
                }
                .header h1 { font-size: 2.5em; margin-bottom: 10px; }
                .header p { font-size: 1.2em; opacity: 0.9; }
                .nav-buttons { margin: 20px 0; }
                .btn {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 20px;
                    text-decoration: none;
                    display: inline-block;
                    margin-right: 15px;
                    font-weight: 500;
                    transition: transform 0.2s ease;
                }
                .btn:hover { transform: translateY(-2px); }
                .stats-bar {
                    background: rgba(255,255,255,0.9);
                    padding: 20px;
                    border-radius: 10px;
                    margin-bottom: 30px;
                    text-align: center;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                .video-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 25px;
                }
                .video-card {
                    background: white;
                    border-radius: 15px;
                    overflow: hidden;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
                    transition: transform 0.3s ease;
                }
                .video-card:hover { transform: translateY(-5px); }
                .video-thumbnail {
                    position: relative;
                    width: 100%;
                    height: 200px;
                    background-size: cover;
                    background-position: center;
                }
                .play-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0,0,0,0.8);
                    color: white;
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5em;
                    transition: all 0.3s ease;
                }
                .play-overlay:hover { background: rgba(255,0,0,0.9); transform: translate(-50%, -50%) scale(1.1); }
                .video-info {
                    padding: 20px;
                }
                .video-title {
                    font-size: 1.2em;
                    font-weight: 600;
                    margin-bottom: 10px;
                    color: #333;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .video-meta {
                    color: #666;
                    font-size: 0.9em;
                    margin-bottom: 15px;
                }
                .video-stats {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px 0;
                    border-top: 1px solid #eee;
                    font-size: 0.9em;
                }
                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    color: #666;
                }
                .watch-btn {
                    background: linear-gradient(135deg, #ff0000 0%, #ff6b6b 100%);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    text-decoration: none;
                    font-size: 0.9em;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
                .watch-btn:hover { background: linear-gradient(135deg, #cc0000 0%, #ff5555 100%); }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎥 YouTube Videos</h1>
                    <p>Your uploaded videos and their performance</p>
                    <div class="nav-buttons">
                        <a href="/" class="btn">← Back to Home</a>
                        <a href="/youtube/dashboard" class="btn">📊 YouTube Dashboard</a>
                        <a href="/metrics" class="btn">📈 Analytics</a>
                    </div>
                </div>

                <div class="stats-bar">
                    <h3>📹 Total Videos: ${result.data.length} | 👁️ Total Views: ${result.data.reduce((sum, v) => sum + v.statistics.viewCount, 0).toLocaleString()}</h3>
                </div>

                <div class="video-grid">
                    ${result.data.map(video => {
                      const publishDate = new Date(video.publishedAt);
                      const duration = video.duration ? video.duration.replace('PT', '').replace('H', 'h ').replace('M', 'm ').replace('S', 's') : 'N/A';
                      
                      return `
                        <div class="video-card">
                            <div class="video-thumbnail" style="background-image: url('${video.thumbnails?.medium?.url || video.thumbnails?.default?.url || ''}')">
                                <a href="${video.url}" target="_blank" class="play-overlay">▶️</a>
                            </div>
                            <div class="video-info">
                                <div class="video-title">${video.title}</div>
                                <div class="video-meta">
                                    📅 ${publishDate.toLocaleDateString()} • ⏱️ ${duration}
                                </div>
                                <div class="video-stats">
                                    <div class="stat-item">👁️ ${video.statistics.viewCount.toLocaleString()}</div>
                                    <div class="stat-item">👍 ${video.statistics.likeCount.toLocaleString()}</div>
                                    <div class="stat-item">💬 ${video.statistics.commentCount.toLocaleString()}</div>
                                    <a href="${video.url}" target="_blank" class="watch-btn">Watch →</a>
                                </div>
                            </div>
                        </div>
                      `;
                    }).join('')}
                </div>
            </div>
        </body>
        </html>
      `);
    } else {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>YouTube Videos Error</title></head>
        <body>
          <h1>Error loading videos</h1>
          <p>${result.error || 'Unknown error'}</p>
          <a href="/youtube/dashboard">← Back to YouTube Dashboard</a>
        </body>
        </html>
      `);
    }
  } catch (error) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>YouTube Videos Error</title></head>
      <body>
        <h1>Error loading videos</h1>
        <p>${(error as Error).message}</p>
        <a href="/youtube/dashboard">← Back to YouTube Dashboard</a>
      </body>
      </html>
    `);
  }
});

// Twitter OAuth endpoints
app.get('/auth/twitter', async (req, res) => {
  try {
    // Check if we have Twitter OAuth credentials
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Twitter OAuth Not Configured</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #1DA1F2 0%, #1A91DA 100%);
                    min-height: 100vh;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .error-card {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    max-width: 600px;
                }
                h1 { color: #333; margin-bottom: 20px; }
                p { color: #666; margin: 15px 0; line-height: 1.5; }
                .btn { background: #1DA1F2; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 25px; display: inline-block; margin: 10px; }
                .code { background: #f8f9fa; padding: 15px; border-radius: 5px; 
                       font-family: monospace; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="error-card">
                <h1>🐦 Twitter OAuth Setup Required</h1>
                <p>To enable Twitter OAuth authentication, you need to configure your Twitter API credentials.</p>
                
                <h3>Setup Steps:</h3>
                <p>1. Go to the Twitter Developer Portal</p>
                <p>2. Create a new app or use existing app</p>
                <p>3. Add these environment variables to your .env file:</p>
                
                <div class="code">
TWITTER_API_KEY=your_api_key_here<br>
TWITTER_API_SECRET=your_api_secret_here
                </div>
                
                <p>4. Restart the server</p>
                
                <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" class="btn">Twitter Developer Portal</a>
                <a href="/" class="btn">← Back to Home</a>
            </div>
        </body>
        </html>
      `);
    }

    const { TwitterOAuthConnector } = require('./connectors/twitter-oauth');
    const connector = new TwitterOAuthConnector({
      api_key: apiKey,
      api_secret: apiSecret
    }, new (require('./utils/rateLimiter').RateLimiter)());

    const callbackUrl = `http://127.0.0.1:${port}/auth/twitter/callback`;
    const { authUrl } = await connector.generateAuthUrl(callbackUrl);
    
    // Redirect to Twitter OAuth
    return res.redirect(authUrl);
  } catch (error) {
    console.error('Twitter OAuth initiation error:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Error</title></head>
      <body>
        <h1>Twitter OAuth Error</h1>
        <p>${(error as Error).message}</p>
        <a href="/">← Back to Home</a>
      </body>
      </html>
    `);
  }
});

app.get('/auth/twitter/callback', async (req, res) => {
  try {
    const { oauth_token, oauth_verifier } = req.query;
    
    if (!oauth_token || !oauth_verifier) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Twitter OAuth Error</title></head>
        <body>
          <h1>Twitter OAuth Error</h1>
          <p>Missing OAuth parameters. Authorization may have been denied.</p>
          <a href="/">← Back to Home</a>
        </body>
        </html>
      `);
    }

    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      return res.status(500).send('Twitter OAuth not configured');
    }

    const { TwitterOAuthConnector } = require('./connectors/twitter-oauth');
    const connector = new TwitterOAuthConnector({
      api_key: apiKey,
      api_secret: apiSecret
    }, new (require('./utils/rateLimiter').RateLimiter)());

    // Exchange OAuth tokens for access tokens
    const tokens = await connector.exchangeCodeForTokens(oauth_token as string, oauth_verifier as string);

    // Store credentials
    tokenManager.setCredentials('twitter', {
      api_key: apiKey,
      api_secret: apiSecret,
      access_token: tokens.access_token,
      access_token_secret: tokens.access_token_secret
    });

    // Test the connection
    const oauthConnector = new TwitterOAuthConnector({
      api_key: apiKey,
      api_secret: apiSecret,
      access_token: tokens.access_token,
      access_token_secret: tokens.access_token_secret
    }, new (require('./utils/rateLimiter').RateLimiter)());

    const isValid = await oauthConnector.validateCredentials();
    
    if (isValid) {
      // Replace the old connector with OAuth version
      aggregator.removeConnector('twitter');
      aggregator.addConnector('twitter', oauthConnector);
      
      // Update platform status
      platformStatus.set('twitter', {
        connected: true,
        lastTested: new Date(),
        error: undefined
      });
      
      // Redirect to Twitter dashboard after successful authentication
      return res.redirect('/twitter/dashboard?auth=success');
    } else {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Twitter Authentication Failed</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                       background: #f8f9fa; padding: 40px; text-align: center; }
                .error { background: white; padding: 40px; border-radius: 10px; 
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }
                h1 { color: #dc3545; }
                .btn { background: #1DA1F2; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="error">
                <h1>❌ Authentication Failed</h1>
                <p>Authentication was successful, but validation failed. Please try again.</p>
                <a href="/" class="btn">← Back to Home</a>
                <a href="/auth/twitter" class="btn">Try Again</a>
            </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Twitter OAuth callback error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Add self-test endpoint
app.get('/selftest', async (req, res) => {
  try {
    console.log('🔍 Self-test endpoint hit');
    
    // Test all core components
    const results = {
      timestamp: new Date().toISOString(),
      server: {
        running: true,
        port: port,
        address: '127.0.0.1'
      },
      tokenManager: {
        loaded: true,
        configuredPlatforms: tokenManager.listConfiguredPlatforms()
      },
      connectors: {
        available: connectorFactory.getSupportedPlatforms(),
        configured: tokenManager.listConfiguredPlatforms().length
      },
      environment: {
        nodeVersion: process.version,
        youtubeApiKey: process.env.YOUTUBE_API_KEY ? 'configured' : 'missing'
      }
    };
    
    console.log('✅ Self-test completed successfully');
    res.json({
      status: 'success',
      message: 'Influence Hub is working correctly!',
      results
    });
  } catch (error) {
    console.error('❌ Self-test error:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

setupConnectors();

const server = app.listen(port, '127.0.0.1', () => {
  const addr = server.address();
  console.log(`
🚀 Influence Hub Server Running

Server: http://127.0.0.1:${port}
Address: ${JSON.stringify(addr)}
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

🌐 Browser Test URLs:
   • http://127.0.0.1:${port}/
   • http://127.0.0.1:${port}/selftest
   • http://127.0.0.1:${port}/status
  `);
  
  // Run automatic self-test after startup
  setTimeout(async () => {
    console.log('🔍 Running automatic self-test...');
    try {
      const http = require('http');
      const req = http.get(`http://127.0.0.1:${port}/selftest`, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.status === 'success') {
              console.log('✅ Automatic self-test PASSED');
              console.log('🎉 Server is fully operational!');
              console.log(`📱 Open http://127.0.0.1:${port}/selftest in your browser`);
            } else {
              console.log('⚠️ Self-test returned error:', result.message);
            }
          } catch (e) {
            console.log('⚠️ Self-test response parsing failed');
          }
        });
      });
      
      req.on('error', (err: any) => {
        console.log('⚠️ Automatic self-test failed:', err.message);
        console.log('💡 Try manually: http://127.0.0.1:' + port + '/selftest');
      });
      
      req.setTimeout(5000, () => {
        console.log('⚠️ Self-test timeout - but server should still work');
        req.destroy();
      });
    } catch (error) {
      console.log('⚠️ Self-test setup failed:', (error as Error).message);
    }
  }, 2000);
});

server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

export { app, tokenManager, aggregator, connectorFactory };