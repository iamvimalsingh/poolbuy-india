import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { joinPoolSchema } from '@/lib/validation';
import { executeJoinPool, getPublicPoolById } from '@/lib/pools';
import { isDemoMode } from '@/lib/data-mode';
import { MOCK_POOLS, recordDemoLead } from '@/lib/mock-data';
import { ApiResponse, JoinPoolResult, JoinPoolInput } from '@/types';

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<ApiResponse<JoinPoolResult>>> {
  try {
    const { poolId } = await context.params;

    if (!poolId || typeof poolId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_POOL', message: 'Valid pool ID is required.' },
        },
        { status: 400 }
      );
    }

    const json = await request.json();
    const parseResult = joinPoolSchema.safeParse(json);

    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: firstIssue?.message || 'Invalid input submission.',
          },
        },
        { status: 400 }
      );
    }

    const validatedInput = parseResult.data;

    const joinInput: JoinPoolInput = {
      fullName: validatedInput.fullName,
      whatsappNumber: validatedInput.whatsappNumber,
      city: validatedInput.city,
      buyingTimeline: validatedInput.buyingTimeline,
      hasExistingQuote: validatedInput.hasExistingQuote,
      existingQuoteAmount: validatedInput.existingQuoteAmount ?? null,
      extraMessage: validatedInput.extraMessage,
      selectedKitOfferId: validatedInput.selectedKitOfferId,
    };

    // Handle Mock Mode
    if (isDemoMode()) {
      const pool = MOCK_POOLS.find((p) => p.id === poolId);
      if (!pool) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'POOL_NOT_FOUND', message: 'Demo pool not found.' },
          },
          { status: 404 }
        );
      }

      // Enforce pool deadline check
      if (new Date(pool.deadline).getTime() < Date.now() || pool.status !== 'ACTIVE') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'POOL_NOT_OPEN',
              message: 'This pool is no longer active or its deadline has expired.',
            },
          },
          { status: 409 }
        );
      }

      // Check city matching
      if (validatedInput.city.trim().toLowerCase() !== pool.city.trim().toLowerCase()) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CITY_MUST_MATCH_POOL',
              message: `You can only join from ${pool.city} for this pool.`,
            },
          },
          { status: 400 }
        );
      }

      // Enforce authoritative pool city in the recorded lead
      joinInput.city = pool.city;
      const result = recordDemoLead(poolId, joinInput);

      // Revalidate affected routes
      try {
        revalidatePath('/');
        revalidatePath(`/city/${pool.citySlug}`);
        revalidatePath(`/category/${pool.category.toLowerCase().replace(/_/g, '-')}`);
        revalidatePath(`/deals/${pool.citySlug}/${pool.slug}`);
      } catch (revalErr) {
        console.warn('Revalidation notice:', revalErr);
      }

      return NextResponse.json({ success: true, data: result });
    }

    // Live Mode via join_pool RPC
    try {
      const pool = await getPublicPoolById(poolId);
      if (!pool) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' },
          },
          { status: 404 }
        );
      }

      // Check city matching
      if (validatedInput.city.trim().toLowerCase() !== pool.city.trim().toLowerCase()) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CITY_MUST_MATCH_POOL',
              message: `You can only join from ${pool.city} for this pool.`,
            },
          },
          { status: 400 }
        );
      }

      // Enforce authoritative pool city in the recorded lead
      joinInput.city = pool.city;
      const result = await executeJoinPool(poolId, joinInput);

      // Revalidate affected routes
      try {
        revalidatePath('/');
        revalidatePath(`/city/${pool.citySlug}`);
        revalidatePath(`/category/${pool.category.toLowerCase().replace(/_/g, '-')}`);
        revalidatePath(`/deals/${pool.citySlug}/${pool.slug}`);
      } catch (revalErr) {
        console.warn('Revalidation notice:', revalErr);
      }

      return NextResponse.json({ success: true, data: result });
    } catch (dbError: unknown) {
      const err = dbError as { message?: string; code?: string };
      const message = err.message || '';

      if (message.includes('POOL_NOT_FOUND')) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' },
          },
          { status: 404 }
        );
      }

      if (message.includes('POOL_NOT_OPEN')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'POOL_NOT_OPEN',
              message: 'This pool is no longer active or its deadline has expired.',
            },
          },
          { status: 409 }
        );
      }

      if (message.includes('CITY_MUST_MATCH_POOL')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'CITY_MUST_MATCH_POOL',
              message: 'Your city must match the pool city to join.',
            },
          },
          { status: 400 }
        );
      }

      if (message.includes('INVALID_INDIAN_MOBILE')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_INDIAN_MOBILE',
              message: 'Invalid 10-digit Indian WhatsApp mobile number.',
            },
          },
          { status: 400 }
        );
      }

      console.error('Unhandled database error in join_pool:', message);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Unable to submit interest at this time. Please try again.',
          },
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('API Error in /api/pools/[poolId]/join:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected server error occurred.',
        },
      },
      { status: 500 }
    );
  }
}
