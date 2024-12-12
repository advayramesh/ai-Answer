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
  
  declare module 'puppeteer' {
    export * from 'puppeteer-core';
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