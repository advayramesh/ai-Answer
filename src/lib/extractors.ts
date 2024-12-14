// src/lib/extractors.ts

import * as cheerio from 'cheerio';
import * as pdfjsLib from 'pdfjs-dist';
import { parse } from 'csv-parse/sync';
import type { ContentResult } from '@/types';
import { truncateText } from "@/lib/utils";

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
      const columns = lines[0]?.split(delimiter)?.length || 0;
      if (columns > maxColumns) {
        maxColumns = columns;
        bestDelimiter = delimiter;
      }
    }

    const headers = lines[0]?.split(bestDelimiter)?.map(h => h.trim()) || [];
    const data: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]?.split(bestDelimiter)?.map(v => v.trim()) || [];
      if (values.length === headers.length) {
        const row: Record<string, any> = {};
        values.forEach((value, index) => {
          const header = headers[index];
          if (header) {
            row[header] = isNaN(Number(value)) ? value : Number(value);
          }
        });
        if (Object.keys(row).length > 0) {
          data.push(row);
        }
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

export async function extractVideoContent(url: string): Promise<string> {
  try {
    // Extensive logging
    console.log('YouTube Video Extraction Started', {
      url,
      youtubeApiKey: process.env.YOUTUBE_API_KEY ? 'Present' : 'Missing',
      apiKeyPrefix: process.env.YOUTUBE_API_KEY?.substring(0, 6)
    });

    // Extract video ID from various YouTube URL formats
    const videoId = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
    )?.[1];

    console.log('Extracted Video ID:', videoId);

    if (!videoId) {
      throw new Error('Invalid YouTube URL: Could not extract video ID');
    }

    // Validate API key
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YouTube API key is not configured in environment variables');
    }

    // Construct API URL
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`;
    
    console.log('API Request URL:', apiUrl);

    // Fetch video data
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('API Response Status:', response.status);

    // Check response status
    if (!response.ok) {
      const errorText = await response.text();
      console.error('YouTube API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`YouTube API request failed: ${response.status} - ${errorText}`);
    }

    // Parse JSON response
    const data = await response.json();
    console.log('Parsed API Response:', JSON.stringify(data, null, 2));

    // Validate response structure
    if (!data.items || data.items.length === 0) {
      throw new Error('No video data found in the API response');
    }

    // Extract video details
    const video = data.items[0];
    const { 
      title = 'N/A', 
      description = 'No description', 
      channelTitle = 'Unknown Channel', 
      publishedAt, 
      tags = [] 
    } = video.snippet || {};

    const { 
      viewCount = '0', 
      likeCount = '0', 
      commentCount = '0' 
    } = video.statistics || {};

    const duration = video.contentDetails?.duration || 'N/A';

    // Prepare content
    const content = `
      YouTube Video Details:
      Title: ${title}
      Channel: ${channelTitle}
      Published: ${publishedAt ? new Date(publishedAt).toLocaleDateString() : 'N/A'}
      Duration: ${duration.replace('PT', '').toLowerCase()}
      Views: ${parseInt(viewCount).toLocaleString()}
      Likes: ${parseInt(likeCount).toLocaleString()}
      Comments: ${parseInt(commentCount).toLocaleString()}
      Description: ${description.slice(0, 500)}...
      ${tags.length ? `Tags: ${tags.slice(0, 10).join(', ')}` : ''}
    `;

    // Visualization data
    const chartData = [
      { metric: 'Views', value: parseInt(viewCount), color: 'rgba(54, 162, 235, 0.6)' },
      { metric: 'Likes', value: parseInt(likeCount), color: 'rgba(255, 99, 132, 0.6)' },
      { metric: 'Comments', value: parseInt(commentCount), color: 'rgba(75, 192, 192, 0.6)' }
    ];

    return JSON.stringify({
      content,
      visualizationData: {
        type: 'bar',
        data: chartData
      }
    });

  } catch (error) {
    console.error('YouTube Video Extraction Failed', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : 'No stack trace'
    });

    return JSON.stringify({
      content: `Failed to extract YouTube video content. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      visualizationData: null
    });
  }
}



// Strict interface for PDF Sections
interface PdfSections {
  title: string;
  authors: string;
  abstract: string;
  introduction: string;
  methodology: string;
  results: string;
  conclusion: string;
  keywords: string[];
  keyFindings: string[];
}

// Function to detect language
function detectLanguage(text: string): string {
  const englishScore = (text.match(/[a-zA-Z]/g) || []).length;
  const totalChars = text.length;
  return (englishScore / totalChars) > 0.7 ? 'English' : 'Other';
}

// Helper to extract key sections
function extractPdfSections(fullText: string): PdfSections {
  const defaultSections: PdfSections = {
    title: '',
    authors: '',
    abstract: '',
    introduction: '',
    methodology: '',
    results: '',
    conclusion: '',
    keywords: [],
    keyFindings: []
  };

  // Regex patterns for section extraction
  const sectionPatterns = {
    title: new RegExp(/^(?:Title:|)(.*?)(?=\n|$)/, 'i'),
    authors: new RegExp(/(?:Author[s]?:|Written by:)\s*(.+?)(?=\n|$)/, 'i'),
    abstract: new RegExp(/(?:Abstract:|Summary:)\s*(.*?)(?=\n\n|\nIntroduction|\nKeywords)/, 'm'),
    introduction: new RegExp(/(?:Introduction:)\s*(.*?)(?=\n\n|\nMethodology|\nResults)/, 'm'),
    methodology: new RegExp(/(?:Methodology:|Method:)\s*(.*?)(?=\n\n|\nResults|\nDiscussion)/, 'm'),
    results: new RegExp(/(?:Results:)\s*(.*?)(?=\n\n|\nDiscussion|\nConclusion)/, 'm'),
    conclusion: new RegExp(/(?:Conclusion:)\s*(.*?)(?=\n\n|$)/, 'm'),
    keywords: new RegExp(/(?:Keywords?:)\s*(.+?)(?=\n|$)/, 'i')
  };

  // Explicitly typed keys
  type SectionKey = keyof typeof sectionPatterns;

  // Extract sections using patterns
  (Object.keys(sectionPatterns) as SectionKey[]).forEach(key => {
    const pattern = sectionPatterns[key];
    const match = fullText.match(pattern);
    
    if (match && match[1]) {
      const value = cleanText(match[1]);
      
      switch(key) {
        case 'keywords':
          defaultSections.keywords = value.split(/[,;]/).map(k => k.trim()).filter(Boolean);
          break;
        case 'title':
          defaultSections.title = value;
          break;
        case 'abstract':
          defaultSections.abstract = value;
          break;
        case 'introduction':
          defaultSections.introduction = value;
          break;
        case 'methodology':
          defaultSections.methodology = value;
          break;
        case 'results':
          defaultSections.results = value;
          break;
        case 'conclusion':
          defaultSections.conclusion = value;
          break;
      }
    }
  });

  // Extract key findings
  const findingPatterns = [
    /([A-Z][^.!?]+(?:demonstrate|show|indicate|reveal)[^.!?]+[.!?])/,
    /([A-Z][^.!?]+(?:significant|important|crucial)[^.!?]+[.!?])/
  ];

  findingPatterns.forEach(pattern => {
    const matches = fullText.match(pattern);
    if (matches) {
      defaultSections.keyFindings.push(...matches.slice(0, 3).map(cleanText));
    }
  });

  return defaultSections;
}

// Main PDF extraction function
export async function extractPDF(url: string): Promise<string> {
  try {
    // Fetch PDF content
    const response = await fetch(url);
    
    // Check if response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Use pdf.js to extract text
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 10); // Limit to first 10 pages

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }

    // Clean and process full text
    fullText = cleanText(fullText);

    // Detect language
    const language = detectLanguage(fullText);

    // Extract sections
    const sections = extractPdfSections(fullText);

    // Prepare content for response
    const content = `PDF Analysis:

Title: ${sections.title || 'Not Found'}
Language: ${language}

Authors: ${sections.authors || 'Not Specified'}

Abstract:
${truncateText(sections.abstract || '', 500) || 'No abstract available'}

Key Keywords:
${(sections.keywords || []).join(', ') || 'No keywords found'}

Key Findings:
${(sections.keyFindings || [])
    .map((finding, i) => `${i + 1}. ${finding}`)
    .join('\n') || 'No key findings extracted'}

Methodology Summary:
${truncateText(sections.methodology || '', 300) || 'Methodology details not clear'}

Conclusion:
${truncateText(sections.conclusion || '', 300) || 'No specific conclusion extracted'}
`;

    return JSON.stringify({
      content,
      visualizationData: null
    });

  } catch (error) {
    console.error('PDF extraction error:', error);
    return JSON.stringify({
      content: `Failed to extract PDF content from: ${url}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      visualizationData: null
    });
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
    
    // If no records, return error
    if (!records || records.length === 0) {
      return `No data found in the CSV file.`;
    }

    // Identify column types
    const headers = Object.keys(records[0]);
    
    // Find numeric columns
    const numericColumns = headers.filter(header => 
      records.every((record: Record<string, any>) => 
        record[header] === '' || 
        !isNaN(Number(record[header]))
      )
    );

    // Find potential label column (non-numeric)
    const labelColumn = headers.find(header => 
      !numericColumns.includes(header)
    ) || headers[0];

    // Prepare visualization data
    const visualizationData = {
      type: numericColumns.length > 2 ? 'line' : 'bar',
      data: records.map((record: Record<string, any>) => {
        const dataPoint: Record<string, any> = {};
        
        // Add label
        if (labelColumn) {
          dataPoint[labelColumn] = record[labelColumn];
        }
        
        // Add numeric columns
        numericColumns.forEach(col => {
          dataPoint[col] = Number(record[col]);
        });
        
        return dataPoint;
      }).slice(0, 50) // Limit to first 50 rows
    };

    // Prepare summary content
    const content = `CSV Data Analysis:
- Total Records: ${records.length}
- Columns: ${headers.join(', ')}
- Numeric Columns: ${numericColumns.join(', ') || 'None'}
- Label Column: ${labelColumn}

Data Summary:
${JSON.stringify(records.slice(0, 5), null, 2)}
`;

    return JSON.stringify({
      content,
      visualizationData
    });

  } catch (error) {
    console.error('CSV extraction error:', error);
    return `Failed to extract CSV content from: ${url}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
      $('a[href]').each((_index: number, el: Element) => {
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
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const fileType = url.split('.').pop()?.toLowerCase();
    
    let result: ContentResult;
    
    if (isYouTube) {
      const videoData = JSON.parse(await extractVideoContent(url));
      result = {
        content: videoData.content,
        visualizationData: videoData.visualizationData
      };
    } else if (fileType === 'pdf') {
      result = { content: await extractPDF(url) };
    } else if (fileType === 'csv') {
      result = { 
        content: await extractCSV(url)
      };
      result.visualizationData = detectChartableData(result.content) || undefined;
    } else {
      result = { content: await extractArticle(url) };
    }

    // Truncate content if too long
    result.content = truncateContent(result.content);

    return result;
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error);
    return { 
      content: `Failed to extract content from: ${url}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}