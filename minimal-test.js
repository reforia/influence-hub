// Ultra-minimal test to isolate the issue

console.log('🔍 Starting minimal Express test...');

const express = require('express');
const app = express();
const port = 3006;

console.log('🔍 Express imported successfully');

// Add logging middleware
app.use((req, res, next) => {
  console.log(`📥 Request: ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  console.log('📍 Root handler executing...');
  res.json({ 
    message: 'Minimal test working!',
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
  console.log('📤 Response sent');
});

console.log('🔍 Routes configured, attempting to listen...');

const server = app.listen(port, (err) => {
  if (err) {
    console.error('❌ Listen callback error:', err);
    return;
  }
  console.log(`✅ Server listening on port ${port}`);
  console.log(`📍 PID: ${process.pid}`);
  console.log(`📍 Test URL: http://localhost:${port}`);
  
  // Test if we can actually connect to ourselves
  setTimeout(() => {
    console.log('🔍 Self-test in 2 seconds...');
    const http = require('http');
    
    const req = http.get(`http://localhost:${port}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ Self-test successful:', data.substring(0, 100));
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Self-test failed:', err.message);
    });
    
    req.setTimeout(3000, () => {
      console.error('❌ Self-test timeout');
      req.destroy();
    });
  }, 2000);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use`);
  }
});

server.on('listening', () => {
  console.log('📡 Server listening event fired');
  const addr = server.address();
  console.log('📍 Address:', addr);
});

// Process error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Keep alive
console.log('🔍 Process started, waiting for connections...');