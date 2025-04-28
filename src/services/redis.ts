import {configStore} from "../config/config.js";
import Redis, { RedisOptions } from 'ioredis';


class RedisService {
  private redisClient: Redis | null;
  private connectionTimeoutId?: NodeJS.Timeout;
  private config = configStore.getRedisConfig();

  constructor() {
    this.redisClient = null;
  }

  private getRedisConfig(): RedisOptions {

    return {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      connectTimeout: this.config.connectionTimeout,
      reconnectOnError: (err) => {
        return err.message.includes('READONLY');
      },
      retryStrategy: (times) => {
        if (times > 3) {
          return null; 
        }
        return Math.min(times * 1000, 30000); 
      },
    };
  }

  
  public getRedisClient(): Redis {

    this.clearConnectionTimeout();
    
    if (!this.redisClient) {
      this.redisClient = new Redis(this.getRedisConfig());
      
      this.redisClient.on('error', (err) => {
        console.error(`[REDIS] Error: ${err}`);
      });

      this.redisClient.on('connect', () => {
        console.log('[REDIS] Connected to Redis server');
      });

      this.redisClient.on('ready', () => {
        console.log('[REDIS] Redis client is ready');
      });

      this.redisClient.on('end', () => {
        console.log('[REDIS] Redis client disconnected');
        this.redisClient = null;
      });
    }

    this.setConnectionTimeout();
    
    return this.redisClient;
  }

  
  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = undefined;
    }
  }

  
  private setConnectionTimeout(): void {
    this.connectionTimeoutId = setTimeout(() => {
      console.log('[REDIS] Connection idle timeout reached, closing Redis client');
      if (this.redisClient) {
        this.redisClient.quit();
        this.redisClient = null;
      }
      this.connectionTimeoutId = undefined;
    }, this.config.connectionTimeout);
  }

  
  public disconnect(): void {
    this.clearConnectionTimeout();
    if (this.redisClient) {
      this.redisClient.quit();
      this.redisClient = null;
    }
  }
}

export default RedisService;