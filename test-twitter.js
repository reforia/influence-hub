require('dotenv').config();
const { TokenManager } = require('./dist/auth/tokenManager');
const { TwitterConnector } = require('./dist/connectors/twitter');
const { RateLimiter } = require('./dist/utils/rateLimiter');

async function testTwitterAPI() {
  console.log('🐦 Testing Twitter API Connection...\n');
  
  const tokenManager = new TokenManager();
  const credentials = tokenManager.getCredentials('twitter');
  
  console.log('Credentials check:');
  console.log('- bearer_token:', credentials && credentials.bearer_token ? 'Present' : 'Missing');
  console.log('- access_token:', credentials && credentials.access_token ? 'Present' : 'Missing');
  console.log();
  
  if (!credentials || (!credentials.bearer_token && !credentials.access_token)) {
    console.log('❌ No Twitter credentials found');
    return;
  }
  
  try {
    const connector = new TwitterConnector(credentials, new RateLimiter());
    
    // Test 1: Validate credentials
    console.log('Test 1: Validating credentials...');
    const isValid = await connector.validateCredentials();
    console.log('✅ Credentials valid:', isValid);
    console.log();
    
    // Test 2: Direct API call
    console.log('Test 2: Direct API call to Twitter...');
    const axios = require('axios');
    try {
      const response = await axios.get('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${credentials.bearer_token}`,
          'User-Agent': 'v2UserLookupJS'
        },
        params: {
          'user.fields': 'public_metrics'
        }
      });
      console.log('✅ Direct API success!');
      console.log('- API Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Direct API error:', error.response?.status, error.response?.statusText);
      console.log('- Error data:', JSON.stringify(error.response?.data, null, 2));
    }
    console.log();
    
    // Test 3: Get recent tweets
    console.log('Test 3: Fetching recent tweets...');
    const tweetsResult = await connector.fetchAnalytics('7');
    console.log('✅ Tweets fetch success:', tweetsResult.success);
    if (tweetsResult.success && tweetsResult.data?.posts) {
      console.log('- Found tweets:', tweetsResult.data.posts.length);
      if (tweetsResult.data.posts.length > 0) {
        console.log('- Latest tweet content:', tweetsResult.data.posts[0].content.substring(0, 80) + '...');
        console.log('- Tweet date:', tweetsResult.data.posts[0].timestamp);
        console.log('- Tweet metrics:', {
          likes: tweetsResult.data.posts[0].metrics.likes,
          retweets: tweetsResult.data.posts[0].metrics.shares,
          replies: tweetsResult.data.posts[0].metrics.comments
        });
      }
    } else {
      console.log('❌ Tweets error:', tweetsResult.error);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('Error details:', error);
  }
}

testTwitterAPI().catch(console.error);