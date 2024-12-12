/// <reference types="node" />
/// <reference types="node-fetch" />
/// <reference types="react" />
/// <reference types="react-dom" />

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
  
  declare module '*.svg' {
    const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
    export default content;
  }
  
  declare module 'groq-sdk' {
    export class Groq {
      constructor(config: { apiKey: string });
      chat: {
        completions: {
          create(options: {
            messages: Array<{ role: string; content: string }>;
            model: string;
            temperature?: number;
            max_tokens?: number;
          }): Promise<{
            choices: Array<{
              message?: {
                content?: string;
              };
            }>;
          }>;
        };
      };
    }
  }
  
  declare module '@upstash/redis' {
    export class Redis {
      constructor(config: { url: string; token: string });
      get(key: string): Promise<any>;
      set(key: string, value: any, options?: { ex?: number }): Promise<any>;
      incr(key: string): Promise<number>;
      expire(key: string, seconds: number): Promise<boolean>;
    }
  }
  
  declare module '@google/generative-ai' {
    export class GoogleGenerativeAI {
      constructor(apiKey: string);
      getGenerativeModel(config: { model: string }): {
        generateContent(prompt: string): Promise<{
          response: {
            text(): string;
          };
        }>;
      };
    }
  }
  
  // Chart types are usually handled by their @types packages, 
  // but we can add specific overrides if needed
  declare module 'chart.js';
  declare module 'react-chartjs-2';
  declare module 'pdfjs-dist';
  declare module 'cheerio';
  declare module 'csv-parse/sync';