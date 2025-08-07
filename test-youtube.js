const https = require('https');

// Test YouTube API directly
const apiKey = 'AIzaSyDdh_-zl1poWeUpWaL3wrdaNQl2DgdTppE';
const testUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=US&maxResults=5&key=${apiKey}`;

console.log('🧪 Testing YouTube API directly...\n');

https.get(testUrl, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.items && result.items.length > 0) {
        console.log('✅ YouTube API Key is working!');
        console.log(`   Found ${result.items.length} trending videos`);
        console.log(`   First video: "${result.items[0].snippet.title}"`);
        console.log(`   Status: ${res.statusCode}\n`);
        
        // Test channel endpoint too
        console.log('🧪 Testing YouTube channel endpoint...');
        const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forUsername=YouTube&key=${apiKey}`;
        
        https.get(channelUrl, (res2) => {
          let data2 = '';
          res2.on('data', chunk => data2 += chunk);
          res2.on('end', () => {
            const result2 = JSON.parse(data2);
            if (result2.items) {
              console.log('✅ YouTube channel stats working!');
              console.log(`   Response: ${JSON.stringify(result2, null, 2)}`);
            } else {
              console.log('⚠️  Channel stats response:', result2);
            }
          });
        });
        
      } else if (result.error) {
        console.log('❌ YouTube API Error:', result.error.message);
      } else {
        console.log('⚠️  Unexpected response:', result);
      }
    } catch (e) {
      console.log('❌ Failed to parse response:', e.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.log('❌ Request failed:', e.message);
});