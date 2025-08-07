// Debug our main server piece by piece

console.log('🔍 Starting main server debug...');

require('dotenv').config();
const express = require('express');

const app = express();
const port = 3008;

console.log('🔍 Adding middleware...');
app.use(express.json());

console.log('🔍 Testing TokenManager...');
try {
  const { TokenManager } = require('./dist/auth/tokenManager');
  const tokenManager = new TokenManager();
  console.log('✅ TokenManager works');
  console.log('🔍 Platforms:', tokenManager.listConfiguredPlatforms());
} catch (error) {
  console.error('❌ TokenManager error:', error.message);
}

console.log('🔍 Adding basic route...');
app.get('/', (req, res) => {
  console.log('📍 Root route hit');
  try {
    res.json({
      name: 'Influence Hub',
      version: '1.0.0',
      description: 'Social media analytics and insights aggregator',
      timestamp: new Date().toISOString()
    });
    console.log('📤 Response sent successfully');
  } catch (error) {
    console.error('❌ Route error:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log('🔍 Adding status route...');
app.get('/status', (req, res) => {
  console.log('📍 Status route hit');
  try {
    const { TokenManager } = require('./dist/auth/tokenManager');
    const tokenManager = new TokenManager();
    
    res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      platforms: {
        configured: tokenManager.listConfiguredPlatforms().length,
        details: tokenManager.listConfiguredPlatforms()
      }
    });
    console.log('📤 Status response sent');
  } catch (error) {
    console.error('❌ Status route error:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log('🔍 Starting server...');

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`✅ Debug server running on http://127.0.0.1:${port}`);
  console.log('📍 Address:', server.address());
  
  // Self test
  setTimeout(() => {
    console.log('🔍 Self-test starting...');
    const http = require('http');
    
    const testReq = http.get(`http://127.0.0.1:${port}/status`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Self-test result:', data.substring(0, 100) + '...');
      });
    });
    
    testReq.on('error', (err) => {
      console.error('❌ Self-test failed:', err.message);
    });
    
    testReq.setTimeout(3000, () => {
      console.error('❌ Self-test timeout');
      testReq.destroy();
    });
  }, 1500);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

console.log('🔍 Debug server setup complete');