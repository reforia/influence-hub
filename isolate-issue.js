// Isolate the exact listen() issue

console.log('🔍 Testing minimal listen() call...');

const express = require('express');
const app = express();
const port = 3012;

app.get('/', (req, res) => {
  res.json({ test: 'minimal' });
});

console.log('🔍 Attempting to listen...');

try {
  const server = app.listen(port, '127.0.0.1', () => {
    console.log('✅ Listen callback called');
    console.log('📍 Address:', server.address());
    
    // Check if port is actually bound
    setTimeout(() => {
      const { exec } = require('child_process');
      exec(`netstat -an | grep ${port}`, (err, stdout) => {
        if (stdout) {
          console.log('✅ Port is bound:', stdout.trim());
        } else {
          console.log('❌ Port NOT bound in netstat');
        }
      });
      
      exec(`lsof -i :${port}`, (err, stdout) => {
        if (stdout) {
          console.log('✅ Process listening:', stdout.trim());
        } else {
          console.log('❌ No process listening');
        }
      });
    }, 1000);
  });
  
  server.on('error', (err) => {
    console.error('❌ Server error:', err);
  });
  
  server.on('listening', () => {
    console.log('📡 Listening event fired');
  });
  
} catch (error) {
  console.error('❌ Exception in listen():', error);
}

// Keep process alive
setInterval(() => {
  console.log('📡 Process alive, checking status...');
}, 3000);