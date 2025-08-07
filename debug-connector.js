require('dotenv').config();
const { TwitterConnector } = require('./dist/connectors/twitter');
const { RateLimiter } = require('./dist/utils/rateLimiter');
const { TokenManager } = require('./dist/auth/tokenManager');

async function debugConnector() {
  console.log('🔧 Debug Twitter Connector fetchAnalytics...\n');
  
  const tokenManager = new TokenManager();
  const credentials = tokenManager.getCredentials('twitter');
  
  if (!credentials) {
    console.log('❌ No credentials found');
    return;
  }
  
  console.log('✓ Credentials loaded');
  console.log('- Has oauth keys:', !!credentials.api_key && !!credentials.api_secret);
  console.log('- Has access tokens:', !!credentials.access_token && !!credentials.access_token_secret);
  
  const rateLimiter = new RateLimiter();
  const connector = new TwitterConnector(credentials, rateLimiter);
  
  console.log('\n🐦 Calling fetchAnalytics(30)...');
  try {
    const result = await connector.fetchAnalytics('30');
    console.log('\n📊 Result:');
    console.log('- Success:', result.success);
    console.log('- Has data:', !!result.data);
    console.log('- Has posts:', !!result.data?.posts);
    console.log('- Posts length:', result.data?.posts?.length || 0);
    
    if (result.success) {
      console.log('\n✅ Full result:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('\n❌ Error:', result.error);
    }
  } catch (error) {
    console.log('\n💥 Exception:', error.message);
    console.log('Stack:', error.stack);
  }
}

debugConnector().catch(console.error);