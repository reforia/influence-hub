const express = require('express');

const app = express();
const port = 3001; // Use different port to avoid conflicts

app.get('/', (req, res) => {
  res.json({ message: 'Test server is working!', port: port });
});

app.get('/test', (req, res) => {
  res.json({ test: 'success', timestamp: new Date().toISOString() });
});

console.log('Starting test server on port', port);

app.listen(port, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`✅ Test server running at http://localhost:${port}`);
  console.log('Try: http://localhost:3001/test');
});

// Add error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});