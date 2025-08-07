console.log('🔍 Debug: Starting minimal server test...');

const express = require('express');
const app = express();
const port = 3004;

app.use(express.json());

console.log('🔍 Debug: Express app created');

app.get('/', (req, res) => {
  console.log('🔍 Debug: Root route hit');
  res.json({ message: 'Minimal server working!', timestamp: new Date() });
});

app.get('/test', (req, res) => {
  console.log('🔍 Debug: Test route hit');
  res.json({ test: 'success' });
});

console.log('🔍 Debug: Routes configured');

// Test our TokenManager
try {
  console.log('🔍 Debug: Testing TokenManager...');
  require('dotenv').config();
  
  // Import the compiled version
  const { TokenManager } = require('./dist/auth/tokenManager');
  const tokenManager = new TokenManager();
  
  console.log('🔍 Debug: TokenManager created');
  const platforms = tokenManager.listConfiguredPlatforms();
  console.log('🔍 Debug: Configured platforms:', platforms);
  
} catch (error) {
  console.error('❌ Debug: TokenManager error:', error.message);
}

console.log('🔍 Debug: Attempting to start server...');

const server = app.listen(port, (err) => {
  if (err) {
    console.error('❌ Debug: Server failed to start:', err);
    return;
  }
  console.log(`✅ Debug: Server running on http://localhost:${port}`);
});

server.on('error', (error) => {
  console.error('❌ Debug: Server error:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Debug: Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Debug: Unhandled Rejection:', reason);
});