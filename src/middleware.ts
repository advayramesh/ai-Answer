// TODO: Implement the code here to add rate limiting with Redis
// Refer to the Next.js Docs: https://nextjs.org/docs/app/building-your-application/routing/middleware
// Refer to Redis docs on Rate Limiting: https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RATE_LIMIT_REQUESTS = 50;
const RATE_LIMIT_WINDOW = 60 * 60; // 1 hour in seconds

// Helper function to make Redis REST API calls
async function redisRequest(endpoint: string, options: RequestInit = {}) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!REDIS_URL || !REDIS_TOKEN) {
    console.warn('Redis credentials not found, rate limiting disabled');
    return null;
  }

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
}

export async function middleware(request: NextRequest) {
  // Log incoming request path
  console.log('Middleware triggered for:', request.nextUrl.pathname);

  // Skip rate limiting for non-API routes and in development
  if (!request.nextUrl.pathname.startsWith('/api/chat')) {
    return NextResponse.next();
  }

  try {
    // Get client IP, with fallbacks for different hosting environments
    const ip = request.headers.get('x-real-ip') ?? 
               request.headers.get('x-forwarded-for')?.split(',')[0] ?? 
               '127.0.0.1';

    const ratelimitKey = `ratelimit:${ip}`;

    // Skip rate limiting if Redis is not configured (e.g., in development)
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.warn('Rate limiting is disabled (Redis not configured)');
      return NextResponse.next();
    }

    // Get current count from Redis
    const countData = await redisRequest(`/get/${ratelimitKey}`);
    const currentCount = countData?.result ? parseInt(countData.result) : 0;

    console.log('Current rate limit count:', currentCount);  // Log current count

    // If the request count exceeds the limit, return a rate limit error
    if (currentCount >= RATE_LIMIT_REQUESTS) {
      console.log('Rate limit exceeded for IP:', ip);  // Log when rate limit is exceeded
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later.'
        }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': RATE_LIMIT_WINDOW.toString(),
          }
        }
      );
    }

    // Increment the count in Redis
    await redisRequest(`/incr/${ratelimitKey}`);
    console.log('Incremented rate limit count for IP:', ip);  // Log when count is incremented

    // Set expiry if this is the first request
    if (currentCount === 0) {
      await redisRequest(`/expire/${ratelimitKey}/${RATE_LIMIT_WINDOW}`);
      console.log('Set expiry for rate limit key:', ratelimitKey);  // Log when expiry is set
    }

    // Add rate limit headers to the response
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_REQUESTS.toString());
    response.headers.set('X-RateLimit-Remaining', (RATE_LIMIT_REQUESTS - currentCount - 1).toString());

    return response;

  } catch (error) {
    console.error('Rate limiting error:', error);  // Log any errors with Redis or middleware
    // Allow requests through if rate limiting fails
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/api/chat']
}
