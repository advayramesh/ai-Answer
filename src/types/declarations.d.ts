/// <reference types="node" />
/// <reference types="node-fetch" />

declare namespace NodeJS {
    interface ProcessEnv {
      UPSTASH_REDIS_REST_URL: string;
      UPSTASH_REDIS_REST_TOKEN: string;
      GROQ_API_KEY: string;
      GEMINI_API_KEY: string;
      YOUTUBE_API_KEY?: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
  
  declare module 'node-fetch' {
    export * from 'node-fetch';
    export default fetch;
  }