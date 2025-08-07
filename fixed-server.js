console.log('🔍 Testing IPv4-only binding...');

const express = require('express');
const app = express();
const port = 3007;
const host = '127.0.0.1'; // Force IPv4

app.use(express.json());

app.get('/', (req, res) => {
  console.log('📍 Request received');
  res.json({ 
    message: 'IPv4 server working!',
    timestamp: new Date().toISOString(),
    host: host,
    port: port
  });
});

app.get('/test', (req, res) => {
  res.json({ test: 'success', ipv4: true });
});

console.log(`🔍 Starting server on ${host}:${port}...`);

const server = app.listen(port, host, () => {
  console.log(`✅ Server running on http://${host}:${port}`);
  console.log(`📍 Address:`, server.address());
  
  // Self test
  setTimeout(() => {
    const http = require('http');
    const req = http.get(`http://${host}:${port}/test`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ IPv4 self-test:', data);
      });
    });
    req.on('error', (err) => console.error('❌ Self-test error:', err.message));
  }, 1000);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});

console.log('🔍 Server setup complete');