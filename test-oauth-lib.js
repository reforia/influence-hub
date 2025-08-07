require('dotenv').config();
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const axios = require('axios');
const { TokenManager } = require('./dist/auth/tokenManager');

async function testWithOAuthLib() {
  console.log('🔧 Testing with oauth-1.0a library...\n');
  
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
  
  const request_data = {
    url: 'https://api.twitter.com/2/users/me',
    method: 'GET',
    data: {
      'user.fields': 'public_metrics'
    }
  };
  
  try {
    const authHeader = oauth.toHeader(oauth.authorize(request_data, token));
    console.log('Generated Auth Header:', authHeader.Authorization.substring(0, 100) + '...\n');
    
    const response = await axios.get(request_data.url, {
      headers: {
        ...authHeader,
        'User-Agent': 'InfluenceHub/1.0'
      },
      params: request_data.data
    });
    
    console.log('✅ SUCCESS! Twitter API working!');
    console.log('User data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.log('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testWithOAuthLib().catch(console.error);