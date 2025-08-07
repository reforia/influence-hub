require('dotenv').config();
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const axios = require('axios');
const { TokenManager } = require('./dist/auth/tokenManager');

async function testTweetsEndpoint() {
  console.log('🐦 Testing Twitter tweets endpoint...\n');
  
  const tokenManager = new TokenManager();
  const credentials = tokenManager.getCredentials('twitter');
  
  if (!credentials) {
    console.log('❌ No credentials found');
    return;
  }
  
  // Initialize OAuth with proper library
  const oauth = OAuth({
    consumer: {
      key: credentials.api_key,
      secret: credentials.api_secret
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto
        .createHmac('sha1', key)
        .update(base_string)
        .digest('base64')
    }
  });
  
  const token = {
    key: credentials.access_token,
    secret: credentials.access_token_secret
  };
  
  // First get user ID
  try {
    const userRequest = {
      url: 'https://api.twitter.com/2/users/me',
      method: 'GET',
      data: {
        'user.fields': 'public_metrics'
      }
    };
    
    const userAuthHeader = oauth.toHeader(oauth.authorize(userRequest, token));
    const userResponse = await axios.get(userRequest.url, {
      headers: {
        ...userAuthHeader,
        'User-Agent': 'InfluenceHub/1.0'
      },
      params: userRequest.data
    });
    
    console.log('✅ User data fetched successfully');
    console.log('User ID:', userResponse.data.data.id);
    console.log('Tweet count:', userResponse.data.data.public_metrics.tweet_count);
    
    const userId = userResponse.data.data.id;
    
    // Now fetch tweets
    const tweetsRequest = {
      url: `https://api.twitter.com/2/users/${userId}/tweets`,
      method: 'GET',
      data: {
        'tweet.fields': 'created_at,public_metrics,entities',
        'max_results': '10'
      }
    };
    
    const tweetsAuthHeader = oauth.toHeader(oauth.authorize(tweetsRequest, token));
    console.log('\n🔍 Fetching tweets from:', tweetsRequest.url);
    console.log('Request params:', tweetsRequest.data);
    
    const tweetsResponse = await axios.get(tweetsRequest.url, {
      headers: {
        ...tweetsAuthHeader,
        'User-Agent': 'InfluenceHub/1.0'
      },
      params: tweetsRequest.data
    });
    
    console.log('\n✅ Tweets response received');
    console.log('Status:', tweetsResponse.status);
    console.log('Response data:', JSON.stringify(tweetsResponse.data, null, 2));
    
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testTweetsEndpoint().catch(console.error);