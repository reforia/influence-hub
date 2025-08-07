// Test different binding methods

const express = require('express');
const net = require('net');

// Test 1: Raw TCP server
console.log('🔍 Test 1: Raw TCP server on port 3010...');
const tcpServer = net.createServer((socket) => {
  console.log('📡 TCP connection received');
  socket.write('HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nTCP server works!\r\n');
  socket.end();
});

tcpServer.listen(3010, '127.0.0.1', () => {
  console.log('✅ TCP server listening on 127.0.0.1:3010');
  
  // Test connection to TCP server
  setTimeout(() => {
    const client = net.connect(3010, '127.0.0.1', () => {
      console.log('✅ TCP self-test connected');
      client.write('GET / HTTP/1.1\r\nHost: localhost\r\n\r\n');
    });
    
    client.on('data', (data) => {
      console.log('✅ TCP response:', data.toString().trim());
      client.end();
    });
    
    client.on('error', (err) => {
      console.error('❌ TCP test error:', err.message);
    });
  }, 500);
});

tcpServer.on('error', (err) => {
  console.error('❌ TCP server error:', err);
});

// Test 2: Express on different port
console.log('🔍 Test 2: Express server on port 3011...');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Express test server working!', port: 3011 });
});

const httpServer = app.listen(3011, '127.0.0.1', () => {
  console.log('✅ Express server listening on 127.0.0.1:3011');
  console.log('📍 Address:', httpServer.address());
});

httpServer.on('error', (err) => {
  console.error('❌ Express server error:', err);
});

// Test 3: Check what's actually listening
setTimeout(() => {
  console.log('🔍 Checking listening ports...');
  const { exec } = require('child_process');
  exec('netstat -an | grep LISTEN | grep -E "(3010|3011)"', (error, stdout, stderr) => {
    if (stdout) {
      console.log('📍 Listening ports:', stdout.trim());
    } else {
      console.log('❌ No ports found listening');
    }
  });
}, 2000);

console.log('🔍 Both servers started, waiting...');