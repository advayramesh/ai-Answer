// src/lib/extractors.ts

import * as cheerio from 'cheerio';
import * as pdfjsLib from 'pdfjs-dist';
import { parse } from 'csv-parse/sync';
import type { ContentResult } from '@/types';

const MAX_CONTENT_LENGTH = 8000;

// Helper to clean text
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

// Helper to truncate text
function truncateContent(text: string): string {
  if (text.length <= MAX_CONTENT_LENGTH) return text;
  const truncated = text.slice(0, MAX_CONTENT_LENGTH);
  const lastPeriod = truncated.lastIndexOf('.');
  return lastPeriod > 0 ? truncated.slice(0, lastPeriod + 1) : truncated;
}

// src/lib/charts.ts
export function detectChartableData(content: string): {
  type: 'line' | 'bar';
  data: Record<string, any>[];
} | null {
  try {
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length < 3) return null;

    const delimiters = [',', '\t', '|'];
    let bestDelimiter = ',';
    let maxColumns = 0;

    for (const delimiter of delimiters) {
      const columns = lines[0].split(delimiter).length;
      if (columns > maxColumns) {
        maxColumns = columns;
        bestDelimiter = delimiter;
      }
    }

    const headers = lines[0].split(bestDelimiter).map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(bestDelimiter).map(v => v.trim());
      if (values.length === headers.length) {
        const row: Record<string, any> = {};
        let hasNumericValue = false;

        headers.forEach((header, index) => {
          const value = values[index].replace(/[,$%]/g, '');
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            row[header] = numValue;
            hasNumericValue = true;
          } else {
            row[header] = values[index];
          }
        });

        if (hasNumericValue) data.push(row);
      }
    }

    if (data.length >= 2) {
      return { 
        type: data.length > 10 ? 'line' : 'bar',
        data 
      };
    }

    return null;
  } catch (error) {
    console.error('Error detecting chartable data:', error);
    return null;
  }
}

async function extractVideoContent(url: string): Promise<string> {
  try {
    // Extract video ID from various YouTube URL formats
    const videoId = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    )?.[1];

    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    // Try YouTube API first if key exists
    if (process.env.YOUTUBE_API_KEY) {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${process.env.YOUTUBE_API_KEY}&part=snippet,contentDetails,statistics`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error('YouTube API request failed');
      }

      const data = await response.json();
      const video = data.items?.[0];

      if (video) {
        const { title, description, tags = [], publishedAt } = video.snippet;
        const { duration } = video.contentDetails;
        const { viewCount, likeCount } = video.statistics;

        return cleanText(`
          Title: ${title}
          Published: ${new Date(publishedAt).toLocaleDateString()}
          Duration: ${duration.replace('PT', '').toLowerCase()}
          Views: ${parseInt(viewCount).toLocaleString()}
          Likes: ${parseInt(likeCount).toLocaleString()}
          Description: ${description}
          ${tags.length ? `Tags: ${tags.join(', ')}` : ''}
        `);
      }
    }

    // Fallback: Scrape metadata from page
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content') || 
                 $('title').text();
    const description = $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="description"]').attr('content');
    const uploadDate = $('meta[itemprop="uploadDate"]').attr('content');
    
    return cleanText(`
      Title: ${title}
      ${uploadDate ? `Upload Date: ${new Date(uploadDate).toLocaleDateString()}` : ''}
      Description: ${description}
      URL: ${url}
    `);

  } catch (error) {
    console.error('Video extraction error:', error);
    return `Failed to extract video content from: ${url}`;
  }
}

// lib/extractors.ts - update the extractPDF function



export async function extractPDF(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer);
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');
      text += pageText + '\n';
    }

    return text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    return `Failed to extract PDF content from: ${url}`;
  }
}
export async function extractCSV(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const records = parse(text, { 
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    // Convert to readable format
    const headers = Object.keys(records[0]);
    const summary = records.slice(0, 10); // First 10 rows
    
    return `
      CSV Headers: ${headers.join(', ')}
      Number of Records: ${records.length}
      Sample Data (first 10 rows):
      ${JSON.stringify(summary, null, 2)}
    `;
  } catch (error) {
    console.error('CSV extraction error:', error);
    return `Failed to extract CSV content from: ${url}`;
  }
}

// Add a type for crawled content
type CrawledContent = {
  url: string;
  content: string;
  links: string[];
  depth: number;
};

// Add crawler configuration
type CrawlerConfig = {
  maxDepth: number;
  maxPages: number;
  allowedDomains?: string[];
  excludePatterns?: RegExp[];
};

// Add crawler function
async function crawlHierarchically(
  startUrl: string, 
  config: CrawlerConfig = { maxDepth: 2, maxPages: 10 }
): Promise<CrawledContent[]> {
  const visited = new Set<string>();
  const results: CrawledContent[] = [];
  
  async function crawl(url: string, depth: number): Promise<void> {
    if (
      depth > config.maxDepth || 
      visited.size >= config.maxPages ||
      visited.has(url)
    ) return;

    try {
      visited.add(url);
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract links
      const links = new Set<string>();
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && !href.startsWith('#')) {
          const fullUrl = new URL(href, url).toString();
          if (config.allowedDomains) {
            const domain = new URL(fullUrl).hostname;
            if (!config.allowedDomains.includes(domain)) return;
          }
          if (config.excludePatterns) {
            if (config.excludePatterns.some(pattern => pattern.test(fullUrl))) return;
          }
          links.add(fullUrl);
        }
      });

      // Extract content
      $('script, style').remove();
      const content = $('body').text().replace(/\s+/g, ' ').trim();

      results.push({
        url,
        content,
        links: Array.from(links),
        depth
      });

      // Crawl linked pages
      for (const link of links) {
        await crawl(link, depth + 1);
      }

    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
    }
  }

  await crawl(startUrl, 0);
  return results;
}

// Update extractArticle to use crawler
export async function extractArticle(url: string): Promise<string> {
  try {
    const crawledData = await crawlHierarchically(url, {
      maxDepth: 1,
      maxPages: 5,
      allowedDomains: [new URL(url).hostname],
      excludePatterns: [/\.(jpg|jpeg|png|gif|pdf|zip|exe)$/i]
    });

    // Combine content from all crawled pages
    return crawledData
      .map(data => `
        Source: ${data.url}
        ${data.content}
        ${data.links.length ? `\nRelated Links:\n${data.links.join('\n')}` : ''}
      `)
      .join('\n\n');

  } catch (error) {
    console.error('Article extraction error:', error);
    return `Failed to extract content from: ${url}`;
  }
}

export async function extractContent(url: string): Promise<ContentResult> {
  try {
    // Determine content type
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const fileType = url.split('.').pop()?.toLowerCase();
    
    let content = '';
    
    if (isYouTube) {
      content = await extractVideoContent(url);
    } else if (fileType === 'pdf') {
      content = await extractPDF(url);
    } else if (fileType === 'csv') {
      content = await extractCSV(url);
    } else {
      content = await extractArticle(url);
    }

    // Truncate content if too long
    content = truncateContent(content);

    const result: ContentResult = {
      content,
      // Add visualization data for CSV files
      visualizationData: fileType === 'csv' ? {
        type: 'line',
        data: JSON.parse(content)
      } : undefined
    };

    return result;
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error);
    return { 
      content: `Failed to extract content from: ${url}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}