require('dotenv').config();

const express = require('express');
const app = express();
const port = 3005;

// Add basic middleware
app.use(express.json());

// Simple test route
app.get('/', (req, res) => {
  console.log('Root route hit');
  res.json({
    message: 'Simple server working',
    timestamp: new Date().toISOString(),
    env: {
      port: process.env.PORT,
      youtube_key: process.env.YOUTUBE_API_KEY ? 'set' : 'missing'
    }
  });
});

app.get('/test', (req, res) => {
  console.log('Test route hit');
  res.json({ test: 'success' });
});

console.log('Starting simple server...');

app.listen(port, '127.0.0.1', () => {
  console.log(`✅ Simple server running on http://127.0.0.1:${port}`);
  console.log(`   Test: curl http://127.0.0.1:${port}/test`);
}).on('error', (err) => {
  console.error('❌ Server error:', err);
});