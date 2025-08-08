import { BaseConnector } from './base';
import { YouTubeConnector } from './youtube';
import { YouTubeOAuthConnector } from './youtube-oauth';
import { TwitterConnector } from './twitter';
import { FacebookConnector } from './facebook';
import { RedditConnector } from './reddit';
import { PlatformCredentials, SupportedPlatform } from '../types';
import { RateLimiter } from '../utils/rateLimiter';

export class ConnectorFactory {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter();
  }

  public createConnector(
    platform: SupportedPlatform, 
    credentials: PlatformCredentials
  ): BaseConnector | null {
    switch (platform) {
      case 'youtube':
        // Use OAuth connector if access tokens are available, otherwise use basic API key connector
        if (credentials.access_token) {
          return new YouTubeOAuthConnector(credentials as any, this.rateLimiter);
        }
        return new YouTubeConnector(credentials, this.rateLimiter);
      
      case 'twitter':
        return new TwitterConnector(credentials, this.rateLimiter);
      
      case 'facebook':
        return new FacebookConnector(credentials, this.rateLimiter);
      
      case 'reddit':
        return new RedditConnector(credentials, this.rateLimiter);
      
      case 'tiktok':
      case 'instagram':
      case 'discord':
        throw new Error(`${platform} connector not yet implemented`);
      
      default:
        return null;
    }
  }

  public getSupportedPlatforms(): SupportedPlatform[] {
    return ['youtube', 'twitter', 'facebook', 'reddit'];
  }

  public getAvailablePlatforms(): SupportedPlatform[] {
    return ['facebook', 'youtube', 'twitter', 'reddit', 'tiktok', 'instagram', 'discord'];
  }
}

export {
  BaseConnector,
  YouTubeConnector,
  YouTubeOAuthConnector,
  TwitterConnector,
  FacebookConnector,
  RedditConnector
};