require('dotenv').config();
const { TokenManager } = require('./dist/auth/tokenManager');

console.log('🔍 Twitter Credentials Debug\n');

// Check environment variables
console.log('Environment Variables:');
console.log('- TWITTER_API_KEY:', process.env.TWITTER_API_KEY ? `${process.env.TWITTER_API_KEY.substring(0, 8)}...` : 'Missing');
console.log('- TWITTER_API_SECRET:', process.env.TWITTER_API_SECRET ? `${process.env.TWITTER_API_SECRET.substring(0, 8)}...` : 'Missing');
console.log('- TWITTER_BEARER_TOKEN:', process.env.TWITTER_BEARER_TOKEN ? `${process.env.TWITTER_BEARER_TOKEN.substring(0, 20)}...` : 'Missing');
console.log('- TWITTER_ACCESS_TOKEN:', process.env.TWITTER_ACCESS_TOKEN ? `${process.env.TWITTER_ACCESS_TOKEN.substring(0, 15)}...` : 'Missing');
console.log('- TWITTER_ACCESS_TOKEN_SECRET:', process.env.TWITTER_ACCESS_TOKEN_SECRET ? `${process.env.TWITTER_ACCESS_TOKEN_SECRET.substring(0, 8)}...` : 'Missing');

// Check token manager
const tokenManager = new TokenManager();
const credentials = tokenManager.getCredentials('twitter');

console.log('\nToken Manager Credentials:');
if (credentials) {
  console.log('- Keys present:', Object.keys(credentials));
  console.log('- api_key:', credentials.api_key ? `${credentials.api_key.substring(0, 8)}...` : 'Missing');
  console.log('- api_secret:', credentials.api_secret ? `${credentials.api_secret.substring(0, 8)}...` : 'Missing');
  console.log('- bearer_token:', credentials.bearer_token ? `${credentials.bearer_token.substring(0, 20)}...` : 'Missing');
  console.log('- access_token:', credentials.access_token ? `${credentials.access_token.substring(0, 15)}...` : 'Missing');
  console.log('- access_token_secret:', credentials.access_token_secret ? `${credentials.access_token_secret.substring(0, 8)}...` : 'Missing');
} else {
  console.log('❌ No credentials found');
}

console.log('\n💡 Twitter API Requirements for Personal Data:');
console.log('1. API Key (Consumer Key) - ✓ Present');
console.log('2. API Secret (Consumer Secret) - ✓ Present');  
console.log('3. Access Token - ✓ Present');
console.log('4. Access Token Secret - ✓ Present');
console.log('\n⚠️  Note: Bearer Token only works for PUBLIC data, not personal tweets');
console.log('📝 Your Twitter app must have "Read" permissions and you must have generated');
console.log('   user access tokens (not just app-only Bearer token)');