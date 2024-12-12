// src/app/api/share/route.ts

import { Redis } from "@upstash/redis";
import type { Conversation } from "@/types";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SHARE_TTL = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: Request) {
  try {
    const { conversation } = await req.json() as { conversation: Conversation };
    const shareId = Math.random().toString(36).substring(7);

    await redis.set(`share:${shareId}`, JSON.stringify(conversation), {
      ex: SHARE_TTL
    });

    return new Response(
      JSON.stringify({ shareId }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Share API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create share link' }),
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shareId = url.searchParams.get('id');

    if (!shareId) {
      return new Response(
        JSON.stringify({ error: 'Share ID required' }),
        { status: 400 }
      );
    }

    const conversation = await redis.get(`share:${shareId}`);
    
    if (!conversation) {
      return new Response(
        JSON.stringify({ error: 'Share not found or expired' }),
        { status: 404 }
      );
    }

    return new Response(
      JSON.stringify({ conversation }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Share API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch shared conversation' }),
      { status: 500 }
    );
  }
}