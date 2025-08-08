import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PlatformCredentials, SupportedPlatform } from '../types';

export class TokenManager {
  private readonly encryptionKey: string;
  private tokens: Map<SupportedPlatform, PlatformCredentials> = new Map();
  private readonly credentialsFile: string;

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey || process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    this.credentialsFile = join(process.cwd(), 'credentials.json');
    this.loadTokensFromEnv();
    this.loadTokensFromFile();
  }

  private encrypt(text: string): string {
    const iv = randomBytes(16);
    const key = createHash('sha256').update(this.encryptionKey).digest().slice(0, 32);
    const cipher = createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return iv + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      // Fallback for old format - just return as-is
      return encryptedData;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const key = createHash('sha256').update(this.encryptionKey).digest().slice(0, 32);
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private loadTokensFromEnv(): void {
    const platforms: Record<SupportedPlatform, string[]> = {
      facebook: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'FACEBOOK_ACCESS_TOKEN'],
      youtube: ['YOUTUBE_API_KEY'],
      twitter: ['TWITTER_API_KEY', 'TWITTER_API_SECRET', 'TWITTER_BEARER_TOKEN', 'TWITTER_ACCESS_TOKEN', 'TWITTER_ACCESS_TOKEN_SECRET'],
      reddit: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USERNAME', 'REDDIT_PASSWORD'],
      tiktok: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
      instagram: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'INSTAGRAM_ACCESS_TOKEN'],
      discord: ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET']
    };

    Object.entries(platforms).forEach(([platform, envVars]) => {
      const credentials: PlatformCredentials = {};
      let hasCredentials = false;

      envVars.forEach(envVar => {
        const value = process.env[envVar];
        if (value) {
          const key = envVar.toLowerCase().replace(`${platform.toLowerCase()}_`, '');
          credentials[key] = value;
          hasCredentials = true;
        }
      });

      if (hasCredentials) {
        this.tokens.set(platform as SupportedPlatform, credentials);
      }
    });
  }

  private loadTokensFromFile(): void {
    try {
      if (existsSync(this.credentialsFile)) {
        const fileContent = readFileSync(this.credentialsFile, 'utf8');
        const savedTokens = JSON.parse(fileContent);
        
        Object.entries(savedTokens).forEach(([platform, credentials]) => {
          this.tokens.set(platform as SupportedPlatform, credentials as PlatformCredentials);
        });
      }
    } catch (error) {
      console.warn('Failed to load saved credentials:', error);
    }
  }

  private saveTokensToFile(): void {
    try {
      const tokensObject = Object.fromEntries(this.tokens);
      writeFileSync(this.credentialsFile, JSON.stringify(tokensObject, null, 2));
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  }

  public setCredentials(platform: SupportedPlatform, credentials: PlatformCredentials): void {
    const encryptedCredentials: PlatformCredentials = {};
    
    Object.entries(credentials).forEach(([key, value]) => {
      if (value !== undefined) {
        encryptedCredentials[key] = this.encrypt(value);
      }
    });

    this.tokens.set(platform, encryptedCredentials);
    this.saveTokensToFile();
  }

  public getCredentials(platform: SupportedPlatform): PlatformCredentials | null {
    const encryptedCredentials = this.tokens.get(platform);
    if (!encryptedCredentials) {
      return null;
    }

    const credentials: PlatformCredentials = {};
    Object.entries(encryptedCredentials).forEach(([key, value]) => {
      if (value !== undefined) {
        try {
          credentials[key] = this.decrypt(value);
        } catch (error) {
          credentials[key] = value;
        }
      }
    });

    return credentials;
  }

  public hasCredentials(platform: SupportedPlatform): boolean {
    return this.tokens.has(platform);
  }

  public removeCredentials(platform: SupportedPlatform): void {
    this.tokens.delete(platform);
    this.saveTokensToFile();
  }

  public listConfiguredPlatforms(): SupportedPlatform[] {
    return Array.from(this.tokens.keys());
  }

  public validateCredentials(platform: SupportedPlatform, credentials: PlatformCredentials): boolean {
    const requiredFields: Record<SupportedPlatform, string[]> = {
      facebook: ['app_id', 'app_secret'],
      youtube: ['api_key'],
      twitter: ['api_key', 'api_secret'],
      reddit: ['client_id', 'client_secret'],
      tiktok: ['client_key', 'client_secret'],
      instagram: ['app_id', 'app_secret'],
      discord: ['bot_token']
    };

    const required = requiredFields[platform];
    if (!required) return false;

    return required.every(field => credentials[field] && credentials[field].length > 0);
  }

  public hashCredentials(platform: SupportedPlatform): string | null {
    const credentials = this.getCredentials(platform);
    if (!credentials) return null;

    const credentialsString = JSON.stringify(credentials);
    return createHash('sha256').update(credentialsString).digest('hex').substring(0, 16);
  }
}