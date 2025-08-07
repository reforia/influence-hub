import dotenv from 'dotenv';
import express from 'express';
import { TokenManager } from './auth/tokenManager';
import { ConnectorFactory } from './connectors';
import { AnalyticsAggregator } from './analytics/aggregator';
import { SupportedPlatform } from './types';
import { YouTubeOAuthConnector } from './connectors/youtube-oauth';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3002');

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
          
          // Test connection asynchronously after server starts
          setTimeout(async () => {
            try {
              const isValid = await connector.testConnection();
              if (isValid) {
                console.log(`✅ ${platform} API validation successful`);
              } else {
                console.warn(`⚠️ ${platform} API validation failed`);
              }
            } catch (error) {
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
                    </div>
                    
                    <div class="card">
                        <h3>🐦 Twitter Analytics</h3>
                        <p>View your tweets, followers, and engagement metrics</p>
                        <a href="/twitter/dashboard" class="btn">Twitter Dashboard</a>
                    </div>
                    
                    <div class="card">
                        <h3>📘 Facebook Analytics</h3>
                        <p>View your Facebook pages, posts, and engagement data</p>
                        <a href="/facebook/dashboard" class="btn">Facebook Dashboard</a>
                    </div>
                    
                    <div class="card">
                        <h3>📈 Trends & Insights</h3>
                        <p>Discover trending topics and engagement patterns</p>
                        <a href="/trends" class="btn">View Trends</a>
                    </div>
                    
                    <div class="card">
                        <h3>⚙️ Platform Settings</h3>
                        <p>Manage connected platforms and API configurations</p>
                        <a href="/platforms" class="btn">Manage Platforms</a>
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
                        <h2>${configuredPlatforms.includes('youtube') ? 'Connected' : 'Not Connected'}</h2>
                        ${configuredPlatforms.includes('youtube') ? 
                          '<p>✅ Ready to fetch your videos</p>' : 
                          '<p><a href="/auth/youtube" style="color:white;">Connect YouTube</a></p>'
                        }
                    </div>
                    
                    <div class="status-card" style="background: linear-gradient(135deg, #1DA1F2 0%, #1A91DA 100%);">
                        <h4>🐦 Twitter Status</h4>
                        <h2>${configuredPlatforms.includes('twitter') ? 'Connected' : 'Not Connected'}</h2>
                        ${configuredPlatforms.includes('twitter') ? 
                          '<p>✅ Ready to fetch your tweets</p>' : 
                          '<p>Add Twitter API credentials to .env</p>'
                        }
                    </div>
                    
                    <div class="status-card" style="background: linear-gradient(135deg, #4267B2 0%, #365899 100%);">
                        <h4>📘 Facebook Status</h4>
                        <h2>${configuredPlatforms.includes('facebook') ? 'Connected' : 'Not Connected'}</h2>
                        ${configuredPlatforms.includes('facebook') ? 
                          '<p>✅ Ready to fetch your pages</p>' : 
                          '<p>Add Facebook API credentials to .env</p>'
                        }
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                    <h3>🔗 Quick Links</h3>
                    <p style="margin: 10px 0;">
                        <a href="/selftest" class="btn" style="margin: 5px;">System Test</a>
                        <a href="/api/status" class="btn" style="margin: 5px;">API Status</a>
                        <a href="https://github.com/your-username/influence-hub" class="btn" style="margin: 5px;">GitHub Repo</a>
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
                      <div class="stat-number">${parseInt(channelResult.data.items[0].statistics?.videoCount || '0').toLocaleString()}</div>
                      <div class="stat-label">Videos</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-number">${parseInt(channelResult.data.items[0].statistics?.viewCount || '0').toLocaleString()}</div>
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
    const connector = new TwitterConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
    
    // Get user profile
    const userResult = await connector.fetchUserMetrics();
    const tweetsResult = await connector.fetchAnalytics('7');

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
              ` : ''}

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
                  ` : '<p>No recent tweets found or error loading tweets.</p>'}
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
    const { TwitterConnector } = require('./connectors/twitter');
    const connector = new TwitterConnector(credentials, new (require('./utils/rateLimiter').RateLimiter)());
    
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
      return res.json({
        error: 'YouTube OAuth required',
        auth_url: `http://127.0.0.1:${port}/auth/youtube`
      });
    }

    const connector = new YouTubeOAuthConnector(credentials as any, new (require('./utils/rateLimiter').RateLimiter)());
    const result = await connector.getUploadedVideos(maxResults);
    
    if (result.success) {
      return res.json({
        success: true,
        videos: result.data,
        total: result.data?.length || 0,
        message: `Found ${result.data?.length || 0} uploaded videos`
      });
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
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