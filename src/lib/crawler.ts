import * as cheerio from 'cheerio';
import { Element } from 'cheerio';

const MAX_DEPTH = 2;
const MAX_PAGES = 10;

type CrawlResult = {
  url: string;
  content: string;
  links: string[];
  mediaLinks: string[];
};

export class WebCrawler {
  private visited = new Set<string>();
  private queue: { url: string; depth: number }[] = [];
  private results: CrawlResult[] = [];
  private baseUrl: string;

  constructor(startUrl: string) {
    this.baseUrl = new URL(startUrl).origin;
    this.queue.push({ url: startUrl, depth: 0 });
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private normalizeUrl(url: string): string {
    if (url.startsWith('/')) {
      return `${this.baseUrl}${url}`;
    }
    return url;
  }

  private async crawlPage(url: string): Promise<CrawlResult | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIAnswerEngine/1.0)'
        }
      });

      if (!response.ok) return null;

      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Remove non-content elements
      $('script, style, nav, footer').remove();

      // Extract links
      const links: string[] = [];
      const mediaLinks: string[] = [];

      $('a').each((_index: number, element: Element) => {
        const href = $(element).attr('href');
        if (href && !href.startsWith('#')) {
          const normalizedUrl = this.normalizeUrl(href);
          if (this.isValidUrl(normalizedUrl)) {
            links.push(normalizedUrl);
          }
        }
      });

      // Extract media links
      $('img, video, audio, source').each((_index: number, element: Element) => {
        const src = $(element).attr('src');
        if (src) {
          const normalizedUrl = this.normalizeUrl(src);
          if (this.isValidUrl(normalizedUrl)) {
            mediaLinks.push(normalizedUrl);
          }
        }
      });

      return {
        url,
        content: $('body').text().replace(/\s+/g, ' ').trim(),
        links,
        mediaLinks
      };
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
      return null;
    }
  }

  public async crawl(): Promise<CrawlResult[]> {
    while (
      this.queue.length > 0 && 
      this.results.length < MAX_PAGES
    ) {
      const current = this.queue.shift();
      if (!current) break;
      
      const { url, depth } = current;
      
      if (this.visited.has(url)) continue;
      this.visited.add(url);

      const result = await this.crawlPage(url);
      if (result) {
        this.results.push(result);

        // Add new links to queue if not at max depth
        if (depth < MAX_DEPTH) {
          for (const link of result.links) {
            if (!this.visited.has(link)) {
              this.queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      }
    }

    return this.results;
  }
}