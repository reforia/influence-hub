const http = require('http');

function testEndpoint(path, name) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log(`✅ ${name}: ${res.statusCode}`);
          console.log(`   Response: ${JSON.stringify(result, null, 2).substring(0, 200)}...`);
          resolve(true);
        } catch (e) {
          console.log(`⚠️  ${name}: ${res.statusCode} (non-JSON response)`);
          resolve(false);
        }
      });
    });

    req.on('timeout', () => {
      console.log(`❌ ${name}: Timeout`);
      req.destroy();
      resolve(false);
    });

    req.on('error', (e) => {
      console.log(`❌ ${name}: ${e.message}`);
      resolve(false);
    });

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Influence Hub API Endpoints...\n');
  
  await testEndpoint('/', 'Root endpoint');
  await testEndpoint('/status', 'Status endpoint');
  await testEndpoint('/platforms', 'Platforms endpoint');
  await testEndpoint('/trends', 'Trends endpoint (YouTube)');
  await testEndpoint('/metrics', 'Metrics endpoint (YouTube)');
  
  console.log('\n🎉 API testing complete!');
  process.exit(0);
}

runTests();