// lib/cache.ts

import { Redis } from "@upstash/redis";

export const CACHE_DURATIONS = {
  LOCAL_STORAGE: 24 * 60 * 60 * 1000, // 24 hours
  REDIS: {
    CONTENT: 60 * 60 * 24, // 24 hours
    SHARE: 60 * 60 * 24 * 7, // 7 days
  }
};

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCachedContent(url: string): Promise<string | null> {
  try {
    return await redis.get(`content:${url}`);
  } catch (error) {
    console.error('Cache error:', error);
    return null;
  }
}

export async function cacheContent(url: string, content: string) {
  try {
    await redis.set(`content:${url}`, content, { ex: CACHE_DURATIONS.REDIS.CONTENT });
  } catch (error) {
    console.error('Cache error:', error);
  }
}