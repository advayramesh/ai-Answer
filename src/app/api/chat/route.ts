// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer
import { NextResponse } from 'next/server';
import { Groq } from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import { truncateText } from "@/lib/utils";
import { extractPDF, extractCSV, extractArticle } from "@/lib/extractors";
import type { ContentResult } from "@/types"

// Constants
const MAX_CONTENT_LENGTH = 4000;
const CACHE_TTL = 60 * 60 * 24; // 24 hours

// Redis setup with proper environment variable check
const redis = (() => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!redisUrl?.startsWith('https://') || !redisToken) {
    console.warn('Redis not properly configured');
    return null;
  }

  return new Redis({
    url: redisUrl,
    token: redisToken,
  });
})();

// Cache helpers with proper null handling
async function getCachedContent(url: string): Promise<ContentResult | null> {
  if (!redis) return null;
  
  try {
    const cachedData = await redis.get(`content:${url}`);
    if (!cachedData) return null;
    
    if (typeof cachedData === 'string') {
      try {
        return JSON.parse(cachedData);
      } catch {
        return { content: cachedData };
      }
    }
    return null;
  } catch (error) {
    console.error('Cache error:', error);
    return null;
  }
}

async function cacheContent(url: string, content: ContentResult): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.set(`content:${url}`, JSON.stringify(content), { ex: CACHE_TTL });
  } catch (error) {
    console.error('Cache error:', error);
  }
}

// Content extraction with proper error handling
async function extractContent(url: string): Promise<ContentResult> {
  if (redis) {
    const cachedContent = await getCachedContent(url);
    if (cachedContent) return cachedContent;
  }

  try {
    const fileType = url.split('.').pop()?.toLowerCase();
    let content = '';

    switch(fileType) {
      case 'pdf':
        content = await extractPDF(url);
        break;
      case 'csv':
        content = await extractCSV(url);
        break;
      default:
        content = await extractArticle(url);
    }

    content = truncateText(content, MAX_CONTENT_LENGTH);

    const result: ContentResult = {
      content,
      visualizationData: fileType === 'csv' ? await processCSVData(content) : undefined
    };

    await cacheContent(url, result);
    return result;
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error);
    return { content: '' };
  }
}

// Process CSV data with proper error handling
async function processCSVData(content: string) {
  try {
    return {
      type: 'line' as const,
      data: JSON.parse(content)
    };
  } catch (error) {
    console.error('Error processing CSV data:', error);
    return undefined;
  }
}

// Model responses with proper error handling
async function getGroqResponse(message: string, context: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const groq = new Groq({ apiKey });
  const truncatedContext = truncateText(context, MAX_CONTENT_LENGTH);

  const systemPrompt = truncatedContext 
    ? `You are a helpful AI assistant. Answer based on this context:\n\n${truncatedContext}`
    : `You are a helpful AI assistant.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.5,
      max_tokens: 1000,
    });

    return completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
  } catch (error: any) {
    if (error?.status === 413) {
      return "Sorry, the content is too long. Please try with a shorter text.";
    }
    throw error;
  }
}

async function getGeminiResponse(message: string, context: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = context 
    ? `Based on the following context, ${message}\n\nContext: ${truncateText(context, MAX_CONTENT_LENGTH)}`
    : message;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini error:', error);
    throw error;
  }
}

// Helper functions for cleaner code organization
async function processUrls(urls: string[]) {
  let context = '';
  const validSources: string[] = [];
  const visualizations: any[] = [];

  for (const url of urls) {
    try {
      const result = await extractContent(url);
      if (result.content) {
        context += result.content + '\n\n';
        validSources.push(url);
        if (result.visualizationData) {
          visualizations.push(result.visualizationData);
        }
      }
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
    }
  }

  return { context, validSources, visualizations };
}

async function getAIResponse(
  message: string, 
  context: { context: string; validSources: string[]; visualizations: any[] }, 
  model: "groq" | "gemini"
): Promise<string> {
  return model === "groq"
    ? await getGroqResponse(message, context.context)
    : await getGeminiResponse(message, context.context);
}

async function generateSuggestions(context: string, message: string, answer: string): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return [];

  try {
    const groq = new Groq({ apiKey });
    const prompt = `Based on this conversation:
Q: ${message}
A: ${answer}
${context ? `\nContext: ${context.slice(0, 500)}...` : ''}

Generate 3 relevant follow-up questions that would help explore this topic further.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 100,
    });

    return completion.choices[0]?.message?.content
      ?.split('\n')
      .map(q => q.trim())
      .filter(q => q && !q.startsWith('#') && !q.startsWith('-'))
      .slice(0, 3) || [];
  } catch {
    return [];
  }
}

// Main POST handler with proper error handling
export const runtime = 'edge';

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
} 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, urls = [], model = "groq" } = body;

    console.log('Environment check:');
    console.log('GROQ_API_KEY length:', process.env.GROQ_API_KEY?.length);
    console.log('GROQ_API_KEY prefix:', process.env.GROQ_API_KEY?.substring(0, 4));
    console.log('Selected model:', model);
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Check environment variables early
    if (model === "groq" && !process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'Groq API not configured' }, { status: 503 });
    }
    if (model === "gemini" && !process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API not configured' }, { status: 503 });
    }

    const context = await processUrls(urls);
    const response = await getAIResponse(message, context, model);
    const suggestions = await generateSuggestions(context.context, message, response);

    return NextResponse.json({
      content: response,
      suggestions,
      sources: context.validSources,
      visualizations: context.visualizations,
    });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    }, { status: 500 });
  }
}