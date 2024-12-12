// TODO: Implement the code here to add rate limiting with Redis
// Refer to the Next.js Docs: https://nextjs.org/docs/app/building-your-application/routing/middleware
// Refer to Redis docs on Rate Limiting: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RATE_LIMIT_REQUESTS = 50;
const RATE_LIMIT_WINDOW = 60 * 60; // 1 hour

async function redisRequest(endpoint: string, options: RequestInit = {}) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!REDIS_URL || !REDIS_TOKEN) {
    console.warn('Redis credentials not found, rate limiting disabled');
    return null;
  }

  try {
    // Ensure we're using the actual URL, not the variable name
    const response = await fetch(`${REDIS_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${REDIS_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Redis request failed: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Redis request error:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/chat')) {
    return NextResponse.next();
  }

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Rate limiting is disabled (Redis not configured)');
    return NextResponse.next();
  }

  try {
    const ip = request.headers.get('x-real-ip') ?? 
               request.headers.get('x-forwarded-for')?.split(',')[0] ?? 
               '127.0.0.1';

    const ratelimitKey = `ratelimit:${ip}`;
    const countData = await redisRequest(`/get/${ratelimitKey}`);
    const currentCount = countData?.result ? parseInt(countData.result) : 0;

    if (currentCount >= RATE_LIMIT_REQUESTS) {
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later.'
        }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': RATE_LIMIT_WINDOW.toString()
          }
        }
      );
    }

    await redisRequest(`/incr/${ratelimitKey}`);
    if (currentCount === 0) {
      await redisRequest(`/expire/${ratelimitKey}/${RATE_LIMIT_WINDOW}`);
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_REQUESTS.toString());
    response.headers.set('X-RateLimit-Remaining', (RATE_LIMIT_REQUESTS - currentCount - 1).toString());

    return response;
  } catch (error) {
    console.error('Rate limiting error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/api/chat']
};