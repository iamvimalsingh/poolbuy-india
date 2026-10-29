import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { joinPoolSchema } from '@/lib/validation';
import { executeJoinPool, getPublicPoolById } from '@/lib/pools';
import { isDemoMode } from '@/lib/data-mode';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { MOCK_POOLS, recordDemoLead, getDemoWaitlist, addDemoWaitlistEntry } from '@/lib/mock-data';
import { ApiResponse, JoinPoolResult, JoinPoolInput } from '@/types';
import { requireD1Database } from '@/lib/d1/db';

type RouteContext = {
  params: Promise<{ poolId: string }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<ApiResponse<JoinPoolResult>>> {
  try {
    // Rate limiting: 30 joins per 60s per client IP
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`join-pool:${clientIp}`, 30, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many join requests. Please wait a minute before trying again.',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(rateCheck.resetMs / 1000).toString(),
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const { poolId } = await context.params;

    if (!poolId || typeof poolId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_POOL', message: 'Valid pool ID is required.' },
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

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
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const validatedInput = parseResult.data;

    const joinInput: JoinPoolInput = {
      fullName: validatedInput.fullName,
      whatsappNumber: validatedInput.whatsappNumber,
      city: validatedInput.city || 'India',
      buyingTimeline: validatedInput.buyingTimeline || 'THIS_MONTH',
      hasExistingQuote: validatedInput.hasExistingQuote,
      existingQuoteAmount: validatedInput.existingQuoteAmount ?? null,
      extraMessage: validatedInput.extraMessage || '',
      selectedKitOfferId: validatedInput.selectedKitOfferId,
      connectionOptIn: validatedInput.connectionOptIn,
      vendorShareConsent: validatedInput.vendorShareConsent,
      locality: validatedInput.locality,
      pinCode: validatedInput.pincode || validatedInput.pinCode,
      pincode: validatedInput.pincode,
      existing_quote: validatedInput.existing_quote ?? null,
      connectionPreference: validatedInput.connectionPreference,
      groupPrivacyAcknowledged: validatedInput.groupPrivacyAcknowledged,
    };

    // Handle Mock Mode
    if (isDemoMode()) {
      const pool = MOCK_POOLS.find((p) => p.id === poolId);
      if (!pool) {
        return NextResponse.json(
          { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (new Date(pool.deadline).getTime() < Date.now() || pool.status !== 'ACTIVE') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'POOL_NOT_OPEN',
              message: 'This pool is no longer active or its deadline has expired.',
            },
          },
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      joinInput.city = pool.city;
      try {
        const result = recordDemoLead(poolId, joinInput);
        return NextResponse.json({ success: true, data: result });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'TARGET_REACHED') {
          const waitlist = getDemoWaitlist(poolId).filter((w) => w.status === 'WAITING');
          if (waitlist.length >= 5) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'POOL_AND_WAITLIST_FULL',
                  message: 'This pool has 10 active members and 5 people on the waitlist. Request a new pool for your requirement.',
                },
              },
              { status: 409, headers: { 'Cache-Control': 'no-store' } }
            );
          }

          const wlEntry = addDemoWaitlistEntry(poolId, {
            fullName: joinInput.fullName,
            whatsappNumber: joinInput.whatsappNumber,
            city: pool.city,
            buyingTimeline: joinInput.buyingTimeline,
            locality: joinInput.locality,
            pinCode: joinInput.pincode || joinInput.pinCode || null,
            pincode: joinInput.pincode || joinInput.pinCode || null,
            existing_quote: joinInput.existing_quote || null,
            notes: joinInput.extraMessage,
          });

          return NextResponse.json(
            {
              success: true,
              data: {
                leadId: wlEntry.id,
                buyerNumber: 0,
                currentBuyers: pool.targetBuyers,
                targetBuyers: pool.targetBuyers,
                remainingBuyers: 0,
                alreadyJoined: false,
                poolStatus: pool.status,
                targetReached: true,
                isDemo: true,
              },
            },
            { status: 201, headers: { 'Cache-Control': 'no-store' } }
          );
        }
        throw err;
      }
    }

    // Live Mode via D1
    const pool = await getPublicPoolById(poolId);
    if (!pool) {
      return NextResponse.json(
        { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    joinInput.city = pool.city;

    try {
      const result = await executeJoinPool(poolId, joinInput);
      return NextResponse.json({ success: true, data: result }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (dbError: unknown) {
      const err = dbError as { message?: string; code?: string };
      const message = err.message || '';

      if (message.includes('POOL_NOT_FOUND')) {
        return NextResponse.json(
          { success: false, error: { code: 'POOL_NOT_FOUND', message: 'Pool not found.' } },
          { status: 404, headers: { 'Cache-Control': 'no-store' } }
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
          { status: 409, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      if (message.includes('TARGET_REACHED')) {
        // Active capacity full (10 members reached) -> Atomic FIFO waitlist placement
        const db = await requireD1Database();

        // 1. Check if user already in waitlist
        const existingWl = await db
          .prepare("SELECT id, sequence_number FROM pool_waitlist WHERE pool_id = ? AND whatsapp_number = ? AND status = 'WAITING'")
          .bind(poolId, joinInput.whatsappNumber)
          .first<{ id: string; sequence_number: number }>();

        if (existingWl) {
          return NextResponse.json(
            {
              success: true,
              data: {
                leadId: existingWl.id,
                buyerNumber: 0,
                currentBuyers: pool.targetBuyers,
                targetBuyers: pool.targetBuyers,
                remainingBuyers: 0,
                alreadyJoined: true,
                isDuplicate: true,
                poolStatus: pool.status,
              },
            },
            { headers: { 'Cache-Control': 'no-store' } }
          );
        }

        // 2. Count current waiting members
        const wlCountRow = await db
          .prepare("SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING'")
          .bind(poolId)
          .first<{ c: number }>();

        const waitlistCount = Number(wlCountRow?.c ?? 0);

        // Maximum 5 waitlist slots
        if (waitlistCount >= 5) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'POOL_AND_WAITLIST_FULL',
                message: 'This pool has 10 active members and 5 people on the waitlist. Request a new pool for your requirement.',
              },
            },
            { status: 409, headers: { 'Cache-Control': 'no-store' } }
          );
        }

        // Add to waitlist with sequence number
        const nextSequence = waitlistCount + 1;
        const waitlistId = `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const now = new Date().toISOString();

        await db
          .prepare(
            `INSERT INTO pool_waitlist (
              id, pool_id, sequence_number, full_name, whatsapp_number, city,
              buying_timeline, locality, pin_code, pincode, existing_quote, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)`
          )
          .bind(
            waitlistId,
            poolId,
            nextSequence,
            joinInput.fullName,
            joinInput.whatsappNumber,
            pool.city,
            joinInput.buyingTimeline || 'THIS_MONTH',
            joinInput.locality || null,
            joinInput.pincode || joinInput.pinCode || null,
            joinInput.pincode || joinInput.pinCode || null,
            joinInput.existing_quote || null,
            now,
            now
          )
          .run();

        try {
          revalidatePath('/');
        } catch {}

        return NextResponse.json(
          {
            success: true,
            data: {
              leadId: waitlistId,
              buyerNumber: 0,
              currentBuyers: pool.targetBuyers,
              targetBuyers: pool.targetBuyers,
              remainingBuyers: 0,
              alreadyJoined: false,
              poolStatus: pool.status,
              targetReached: true,
            },
          },
          { status: 201, headers: { 'Cache-Control': 'no-store' } }
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
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
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
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
