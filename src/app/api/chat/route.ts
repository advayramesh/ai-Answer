// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer
import { NextResponse } from 'next/server';
import { Groq } from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";
import { Redis } from "@upstash/redis";
import { truncateText } from "../../../lib/utils";            // Use relative path
import { extractPDF, extractCSV, extractArticle } from "../../../lib/extractors";
import type { ContentResult } from "../../../types";
// Constants
const MAX_CONTENT_LENGTH = 4000;
const CACHE_TTL = 60 * 60 * 24; // 24 hours

// Redis setup
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache helpers
async function getCachedContent(url: string): Promise<ContentResult | null> {
  try {
    const cachedData = await redis.get(`content:${url}`);
    if (!cachedData) return null;
    
    // Handle both string and object cache formats
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

async function cacheContent(url: string, content: ContentResult) {
  try {
    const stringifiedContent = JSON.stringify(content);
    await redis.set(`content:${url}`, stringifiedContent, { ex: CACHE_TTL });
  } catch (error) {
    console.error('Cache error:', error);
  }
}

// Content extraction
async function extractContent(url: string): Promise<ContentResult> {
  const cachedContent = await getCachedContent(url);
  if (cachedContent) return cachedContent;

  try {
    let content = '';
    const fileType = url.split('.').pop()?.toLowerCase();

    if (fileType === 'pdf') {
      content = await extractPDF(url);
    } else if (fileType === 'csv') {
      content = await extractCSV(url);
    } else {
      content = await extractArticle(url);
    }

    // Truncate content to avoid rate limits
    content = truncateText(content, MAX_CONTENT_LENGTH);

    const result: ContentResult = {
      content,
      visualizationData: fileType === 'csv' ? {
        type: 'line',
        data: JSON.parse(content)
      } : undefined
    };

    const chartData = content.includes(',') ? detectChartableData(content) : null;
    if (chartData) {
      result.visualizationData = chartData;
    }

    await cacheContent(url, result);
    return result;
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error);
    return { content: '' };
  }
}

// Model responses
async function getGroqResponse(message: string, context: string): Promise<string> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
  const truncatedContext = truncateText(context, MAX_CONTENT_LENGTH);

  const systemPrompt = truncatedContext 
    ? `You are a helpful AI assistant. Answer based on this context. Be concise but informative:\n\n${truncatedContext}`
    : `You are a helpful AI assistant. Be concise but informative.`;

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
      return "Sorry, the content is too long. Please try with a shorter text or break your request into smaller parts.";
    }
    console.error('Groq error:', error);
    throw error;
  }
}

async function getGeminiResponse(message: string, context: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
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

async function generateSuggestions(context: string, message: string, answer: string): Promise<string[]> {
  if (!process.env.GROQ_API_KEY) return [];

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const prompt = `Based on this conversation:
Q: ${message}
A: ${answer}
${context ? `\nContext: ${context.slice(0, 500)}...` : ''}

Generate 3 relevant follow-up questions that would help explore this topic further. Make them concise and specific.`;

  try {
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

// Chart detection
type ChartData = {
  type: 'line' | 'bar';
  data: Record<string, any>[];
};

function detectChartableData(content: string): ChartData | null {
  try {
    // Look for different data patterns
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length < 3) return null; // Need at least header + 2 rows

    // Try different delimiters
    const delimiters = [',', '\t', '|'];
    let bestDelimiter = ',';
    let maxColumns = 0;

    // Find the best delimiter
    for (const delimiter of delimiters) {
      const columns = lines[0].split(delimiter).length;
      if (columns > maxColumns) {
        maxColumns = columns;
        bestDelimiter = delimiter;
      }
    }

    const headers = lines[0].split(bestDelimiter).map(h => h.trim());
    const data: Record<string, any>[] = [];

    // Process each line
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(bestDelimiter).map(v => v.trim());
      if (values.length === headers.length) {
        const row: Record<string, any> = {};
        let hasNumericValue = false;

        headers.forEach((header, index) => {
          // Clean and convert values
          const value = values[index].replace(/[,$%]/g, '');
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            row[header] = numValue;
            hasNumericValue = true;
          } else {
            row[header] = values[index];
          }
        });

        if (hasNumericValue) {
          data.push(row);
        }
      }
    }

    if (data.length >= 2) {
      const type = data.length > 10 ? 'line' : 'bar';
      return { type, data };
    }

    return null;
  } catch (error) {
    console.error('Error detecting chartable data:', error);
    return null;
  }
}

// Main POST handler
export const runtime = 'edge'; // Optional: Use edge runtime

export async function POST(req: Request) {
  try {
    const { message, urls = [], model = "groq" } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    let context = '';
    let validSources: string[] = [];
    let visualizations: ChartData[] = [];

    // Process URLs for additional content
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

    // Get AI response based on selected model
    const response = model === "groq"
      ? await getGroqResponse(message, context)
      : await getGeminiResponse(message, context);

    const suggestions = await generateSuggestions(context, message, response);

    return NextResponse.json({
      content: response,
      suggestions,
      sources: validSources,
      visualizations,
    });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
