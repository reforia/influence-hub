const axios = require('axios');

async function testWebEndpoint() {
  console.log('🌐 Testing web endpoint directly...\n');
  
  try {
    console.log('Making request to: http://127.0.0.1:3002/twitter/tweets');
    console.log('This will trigger the server-side fetchAnalytics call...\n');
    
    // This will trigger the server to call fetchAnalytics
    const response = await axios.get('http://127.0.0.1:3002/twitter/tweets', {
      timeout: 30000
    });
    
    console.log('✅ Got response');
    console.log('Status:', response.status);
    
    // Check if we got tweets or the no-tweets message
    const html = response.data;
    const hasTweets = html.includes('tweet-card');
    const hasNoTweets = html.includes('No Tweets Found');
    
    console.log('Has tweet cards:', hasTweets);
    console.log('Has "No Tweets Found":', hasNoTweets);
    
    if (hasNoTweets) {
      console.log('\n🔍 Still showing no tweets - need to check server logs');
    } else if (hasTweets) {
      console.log('\n✅ Tweets are showing!');
    }
    
  } catch (error) {
    console.log('❌ Web request failed:', error.message);
  }
}

testWebEndpoint().catch(console.error);