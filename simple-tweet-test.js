require('dotenv').config();
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const axios = require('axios');
const { TokenManager } = require('./dist/auth/tokenManager');

async function simpleTweetTest() {
  console.log('🐦 Simple Tweet Test (bypassing rate limits)...\n');
  
  const tokenManager = new TokenManager();
  const credentials = tokenManager.getCredentials('twitter');
  
  if (!credentials) {
    console.log('❌ No credentials found');
    return;
  }
  
  const oauth = OAuth({
    consumer: {
      key: credentials.api_key,
      secret: credentials.api_secret
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto.createHmac('sha1', key).update(base_string).digest('base64')
    }
  });
  
  const token = {
    key: credentials.access_token,
    secret: credentials.access_token_secret
  };
  
  try {
    // Just get user tweets with minimal parameters
    const request_data = {
      url: 'https://api.twitter.com/2/users/1953329530657226753/tweets',
      method: 'GET',
      data: {
        'max_results': '5'
      }
    };
    
    console.log('🔍 Making simple request for tweets...');
    console.log('URL:', request_data.url);
    console.log('Params:', request_data.data);
    
    const authHeader = oauth.toHeader(oauth.authorize(request_data, token));
    
    const response = await axios.get(request_data.url, {
      headers: {
        ...authHeader,
        'User-Agent': 'InfluenceHub/1.0'
      },
      params: request_data.data
    });
    
    console.log('\n✅ SUCCESS!');
    console.log('Status:', response.status);
    console.log('Tweet count:', response.data.data?.length || 0);
    
    if (response.data.data && response.data.data.length > 0) {
      console.log('\n📝 Tweets found:');
      response.data.data.forEach((tweet, i) => {
        console.log(`${i+1}. "${tweet.text.substring(0, 50)}..." (${tweet.created_at || 'no date'})`);
      });
    } else {
      console.log('\n📝 No tweets in response');
    }
    
    console.log('\nFull response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Only run if we haven't hit rate limits recently
const lastRun = Date.now();
console.log('Current time:', new Date().toISOString());

simpleTweetTest().catch(console.error);