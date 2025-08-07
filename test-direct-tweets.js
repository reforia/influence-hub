require('dotenv').config();
const { TwitterConnector } = require('./dist/connectors/twitter');
const { RateLimiter } = require('./dist/utils/rateLimiter');
const { TokenManager } = require('./dist/auth/tokenManager');

async function testDirectCall() {
  console.log('🔧 Testing direct TwitterConnector call...\n');
  
  const tokenManager = new TokenManager();
  const credentials = tokenManager.getCredentials('twitter');
  
  console.log('Credentials check:');
  console.log('- Has API key:', !!credentials?.api_key);
  console.log('- Has API secret:', !!credentials?.api_secret);
  console.log('- Has access token:', !!credentials?.access_token);
  console.log('- Has access token secret:', !!credentials?.access_token_secret);
  
  if (!credentials) {
    console.log('❌ No credentials - cannot test');
    return;
  }
  
  const rateLimiter = new RateLimiter();
  const connector = new TwitterConnector(credentials, rateLimiter);
  
  console.log('\n🐦 Calling fetchAnalytics directly...');
  
  try {
    const result = await connector.fetchAnalytics('7');
    
    console.log('\nResult summary:');
    console.log('- Success:', result.success);
    
    if (result.success) {
      console.log('- Has data:', !!result.data);
      console.log('- Platform:', result.data?.platform);
      console.log('- Posts count:', result.data?.posts?.length || 0);
      console.log('- Followers:', result.data?.metrics?.followers || 0);
      
      if (result.data?.posts && result.data.posts.length > 0) {
        console.log('\n📝 Found posts:');
        result.data.posts.forEach((post, i) => {
          console.log(`  ${i+1}. "${post.content.substring(0, 40)}..."`);
          console.log(`      Likes: ${post.metrics.likes}, Shares: ${post.metrics.shares}`);
        });
      } else {
        console.log('\n📝 No posts found - this is the problem!');
        console.log('Full data:', JSON.stringify(result.data, null, 2));
      }
    } else {
      console.log('- Error:', result.error);
    }
    
  } catch (error) {
    console.log('💥 Exception during fetchAnalytics:', error.message);
    console.log('Stack:', error.stack);
  }
}

testDirectCall().catch(console.error);