import { NextRequest, NextResponse } from 'next/server';
import { poolRequestSchema } from '@/lib/validation';
import { executePoolRequest } from '@/lib/requests';
import { ApiResponse } from '@/types';

// In-memory sliding-window rate limiter: max 15 requests per 10 minutes per IP
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 15;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true;
  }

  record.count += 1;
  return false;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ id: string; isDemo: boolean; isDuplicate?: boolean; existingRequestId?: string }>>> {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown-ip';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests submitted. Please wait a few minutes before submitting another request.',
          },
        },
        { status: 429 }
      );
    }

    const json = await request.json();
    const parseResult = poolRequestSchema.safeParse(json);

    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: firstIssue?.message || 'Invalid pool request payload.',
          },
        },
        { status: 400 }
      );
    }

    const result = await executePoolRequest(parseResult.data);

    if (result.isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DUPLICATE_ACTIVE_REQUEST',
            message: 'You already have an active interest request for this product in this city.',
          },
          data: {
            id: result.id,
            isDemo: result.isDemo,
            isDuplicate: true,
            existingRequestId: result.existingRequestId,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === 'CATEGORY_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: 'The selected category does not exist or has been removed.',
          },
        },
        { status: 400 }
      );
    }
    if (err.message === 'CATEGORY_INACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CATEGORY_INACTIVE',
            message: 'The selected category is currently inactive and not accepting new pool requests.',
          },
        },
        { status: 400 }
      );
    }
    if (err.message === 'CITY_INACTIVE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CITY_INACTIVE',
            message: 'The selected city is currently inactive and not accepting new pool requests.',
          },
        },
        { status: 400 }
      );
    }
    console.error('API Error in /api/pool-requests:', err.message);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unable to submit pool request at this time. Please try again later.',
        },
      },
      { status: 500 }
    );
  }
}
