require('dotenv').config();
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const axios = require('axios');
const { TokenManager } = require('./dist/auth/tokenManager');

async function testTweetsWithTimeFilter() {
  console.log('🐦 Testing Twitter tweets with time filter...\n');
  
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
  
  try {
    // First get user ID
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
    
    const userId = userResponse.data.data.id;
    console.log('✅ User ID:', userId);
    
    // Test without start_time first
    console.log('\n🔍 Testing tweets WITHOUT start_time...');
    const tweetsRequest1 = {
      url: `https://api.twitter.com/2/users/${userId}/tweets`,
      method: 'GET',
      data: {
        'tweet.fields': 'created_at,public_metrics,entities',
        'max_results': '10'
      }
    };
    
    const tweetsAuthHeader1 = oauth.toHeader(oauth.authorize(tweetsRequest1, token));
    const tweetsResponse1 = await axios.get(tweetsRequest1.url, {
      headers: {
        ...tweetsAuthHeader1,
        'User-Agent': 'InfluenceHub/1.0'
      },
      params: tweetsRequest1.data
    });
    
    console.log('✅ Response without start_time:');
    console.log('- Status:', tweetsResponse1.status);
    console.log('- Tweet count:', tweetsResponse1.data.data?.length || 0);
    
    // Test with start_time (30 days ago)
    console.log('\n🔍 Testing tweets WITH start_time (30 days)...');
    const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    console.log('- Start time:', startTime);
    
    const tweetsRequest2 = {
      url: `https://api.twitter.com/2/users/${userId}/tweets`,
      method: 'GET',
      data: {
        'tweet.fields': 'created_at,public_metrics,entities',
        'start_time': startTime,
        'max_results': '10'
      }
    };
    
    const tweetsAuthHeader2 = oauth.toHeader(oauth.authorize(tweetsRequest2, token));
    const tweetsResponse2 = await axios.get(tweetsRequest2.url, {
      headers: {
        ...tweetsAuthHeader2,
        'User-Agent': 'InfluenceHub/1.0'
      },
      params: tweetsRequest2.data
    });
    
    console.log('✅ Response with start_time:');
    console.log('- Status:', tweetsResponse2.status);
    console.log('- Tweet count:', tweetsResponse2.data.data?.length || 0);
    if (tweetsResponse2.data.data?.length > 0) {
      console.log('- First tweet date:', tweetsResponse2.data.data[0].created_at);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testTweetsWithTimeFilter().catch(console.error);