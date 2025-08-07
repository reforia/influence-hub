import { RateLimitConfig } from '@/types';

export class RateLimiter {
  private limits: Map<string, RateLimitState> = new Map();

  private interface RateLimitState {
    requests: number;
    dailyRequests: number;
    lastReset: Date;
    lastDailyReset: Date;
  }

  public async checkLimit(platform: string, config: RateLimitConfig): Promise<boolean> {
    const now = new Date();
    const state = this.getOrCreateState(platform, now);

    if (now.getTime() - state.lastReset.getTime() >= 3600000) {
      state.requests = 0;
      state.lastReset = now;
    }

    if (now.getTime() - state.lastDailyReset.getTime() >= 86400000) {
      state.dailyRequests = 0;
      state.lastDailyReset = now;
    }

    if (state.requests >= config.requestsPerHour) {
      return false;
    }

    if (state.dailyRequests >= config.requestsPerDay) {
      return false;
    }

    state.requests++;
    state.dailyRequests++;
    this.limits.set(platform, state);

    return true;
  }

  public getRemainingRequests(platform: string, config: RateLimitConfig): { hourly: number; daily: number } {
    const state = this.limits.get(platform);
    if (!state) {
      return {
        hourly: config.requestsPerHour,
        daily: config.requestsPerDay
      };
    }

    const now = new Date();
    
    if (now.getTime() - state.lastReset.getTime() >= 3600000) {
      return {
        hourly: config.requestsPerHour,
        daily: Math.max(0, config.requestsPerDay - state.dailyRequests)
      };
    }

    if (now.getTime() - state.lastDailyReset.getTime() >= 86400000) {
      return {
        hourly: Math.max(0, config.requestsPerHour - state.requests),
        daily: config.requestsPerDay
      };
    }

    return {
      hourly: Math.max(0, config.requestsPerHour - state.requests),
      daily: Math.max(0, config.requestsPerDay - state.dailyRequests)
    };
  }

  public getResetTime(platform: string): { hourly: Date; daily: Date } {
    const state = this.limits.get(platform);
    const now = new Date();

    if (!state) {
      return {
        hourly: new Date(now.getTime() + 3600000),
        daily: new Date(now.getTime() + 86400000)
      };
    }

    return {
      hourly: new Date(state.lastReset.getTime() + 3600000),
      daily: new Date(state.lastDailyReset.getTime() + 86400000)
    };
  }

  private getOrCreateState(platform: string, now: Date): RateLimitState {
    let state = this.limits.get(platform);
    
    if (!state) {
      state = {
        requests: 0,
        dailyRequests: 0,
        lastReset: now,
        lastDailyReset: now
      };
      this.limits.set(platform, state);
    }

    return state;
  }

  public async waitForLimit(platform: string, config: RateLimitConfig): Promise<void> {
    while (!(await this.checkLimit(platform, config))) {
      const resetTimes = this.getResetTime(platform);
      const now = new Date();
      const waitTime = Math.min(
        resetTimes.hourly.getTime() - now.getTime(),
        resetTimes.daily.getTime() - now.getTime()
      );
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 60000)));
      } else {
        break;
      }
    }
  }
}