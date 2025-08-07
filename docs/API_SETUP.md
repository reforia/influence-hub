# API Setup Guide

This guide walks you through setting up API credentials for each supported social media platform.

## Facebook/Meta API

1. **Create a Facebook App**:
   - Go to [Facebook Developers](https://developers.facebook.com/)
   - Click "Create App" → "Business" → "Connect to APIs"
   - Add your app name and contact email

2. **Get Credentials**:
   - App ID: Found in App Settings → Basic
   - App Secret: Found in App Settings → Basic (click "Show")
   - Access Token: Generate in Tools → Graph API Explorer

3. **Environment Variables**:
   ```bash
   FACEBOOK_APP_ID=your_app_id
   FACEBOOK_APP_SECRET=your_app_secret
   FACEBOOK_ACCESS_TOKEN=your_access_token
   ```

## YouTube Data API

1. **Enable YouTube Data API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable "YouTube Data API v3"
   - Create credentials → API Key

2. **Environment Variables**:
   ```bash
   YOUTUBE_API_KEY=your_api_key
   ```

## Twitter/X API

1. **Apply for Developer Account**:
   - Go to [Twitter Developer Portal](https://developer.twitter.com/)
   - Apply for developer account
   - Create a new app

2. **Get Credentials**:
   - API Key & Secret: App settings → Keys and tokens
   - Access Token & Secret: Generate in same section

3. **Environment Variables**:
   ```bash
   TWITTER_API_KEY=your_api_key
   TWITTER_API_SECRET=your_api_secret
   TWITTER_ACCESS_TOKEN=your_access_token
   TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
   ```

## Reddit API

1. **Create Reddit App**:
   - Go to [Reddit Apps](https://www.reddit.com/prefs/apps/)
   - Click "Create App" or "Create Another App"
   - Choose "script" type

2. **Get Credentials**:
   - Client ID: Under app name (14 character string)
   - Client Secret: "secret" field

3. **Environment Variables**:
   ```bash
   REDDIT_CLIENT_ID=your_client_id
   REDDIT_CLIENT_SECRET=your_client_secret
   REDDIT_USERNAME=your_reddit_username
   REDDIT_PASSWORD=your_reddit_password
   ```

## TikTok API

1. **Register for TikTok Developer**:
   - Go to [TikTok Developers](https://developers.tiktok.com/)
   - Create developer account
   - Create a new app

2. **Environment Variables**:
   ```bash
   TIKTOK_CLIENT_KEY=your_client_key
   TIKTOK_CLIENT_SECRET=your_client_secret
   ```

## Instagram Basic Display API

1. **Create Facebook App** (Instagram uses Facebook's platform):
   - Follow Facebook setup above
   - Add Instagram Basic Display product to your app

2. **Environment Variables**:
   ```bash
   INSTAGRAM_APP_ID=your_app_id
   INSTAGRAM_APP_SECRET=your_app_secret
   INSTAGRAM_ACCESS_TOKEN=your_access_token
   ```

## Discord API

1. **Create Discord Application**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Click "New Application"
   - Go to Bot section and create bot

2. **Get Credentials**:
   - Client ID & Secret: OAuth2 → General
   - Bot Token: Bot section → Token

3. **Environment Variables**:
   ```bash
   DISCORD_BOT_TOKEN=your_bot_token
   DISCORD_CLIENT_ID=your_client_id
   DISCORD_CLIENT_SECRET=your_client_secret
   ```

## Rate Limits

Each platform has different rate limits:

- **YouTube**: 10,000 requests/hour, 1,000,000/day
- **Twitter**: 300 requests/hour, 500/day (varies by endpoint)
- **Reddit**: 600 requests/hour, 1,000/day
- **Facebook**: Varies by app usage
- **TikTok**: 1,000 requests/day
- **Instagram**: 200 requests/hour
- **Discord**: 50 requests/second (with burst allowance)

## Testing Your Setup

After configuring credentials, test your setup:

```bash
# Start the server
npm run dev

# Check platform status
curl http://localhost:3000/platforms

# Test metrics endpoint
curl http://localhost:3000/metrics
```

## Security Best Practices

1. **Never commit credentials** to your repository
2. **Use environment variables** for all sensitive data
3. **Rotate tokens regularly** when possible
4. **Use minimal permissions** required for your use case
5. **Monitor API usage** to stay within rate limits