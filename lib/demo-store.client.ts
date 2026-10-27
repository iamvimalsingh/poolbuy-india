'use client';

import { JoinPoolInput, JoinPoolResult, PoolRequest } from '@/types';
import { MOCK_POOLS } from './mock-data';

const DEMO_LEADS_KEY = 'poolbuy_demo_leads';
const DEMO_REQUESTS_KEY = 'poolbuy_demo_requests';
const DEMO_COUNTS_KEY = 'poolbuy_demo_pool_counts';

interface DemoLeadRecord extends JoinPoolInput {
  id: string;
  poolId: string;
  buyerNumber: number;
  createdAt: string;
}

function getStoredJson<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStoredJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota or disabled storage
  }
}

/**
 * Gets the current count for a pool in demo mode, reflecting any local demo joins
 */
export function getDemoPoolCount(poolId: string): number {
  const counts = getStoredJson<Record<string, number>>(DEMO_COUNTS_KEY, {});
  if (typeof counts[poolId] === 'number') {
    return counts[poolId];
  }
  const pool = MOCK_POOLS.find((p) => p.id === poolId);
  return pool ? pool.currentBuyers : 0;
}

/**
 * Handles an idempotent demo join in browser localStorage
 */
export function submitDemoJoin(poolId: string, input: JoinPoolInput): JoinPoolResult {
  const pool = MOCK_POOLS.find((p) => p.id === poolId);
  const targetBuyers = pool ? pool.targetBuyers : 10;
  const status = pool ? pool.status : 'ACTIVE';

  const leads = getStoredJson<DemoLeadRecord[]>(DEMO_LEADS_KEY, []);

  // Check duplicate
  const existing = leads.find(
    (l) => l.poolId === poolId && l.whatsappNumber === input.whatsappNumber
  );

  const currentCount = getDemoPoolCount(poolId);

  if (existing) {
    return {
      leadId: existing.id,
      buyerNumber: existing.buyerNumber,
      currentBuyers: currentCount,
      targetBuyers,
      remainingBuyers: Math.max(0, targetBuyers - currentCount),
      alreadyJoined: true,
      poolStatus: status,
    };
  }

  // New demo join
  const newCount = currentCount + 1;
  const counts = getStoredJson<Record<string, number>>(DEMO_COUNTS_KEY, {});
  counts[poolId] = newCount;
  setStoredJson(DEMO_COUNTS_KEY, counts);

  const newLead: DemoLeadRecord = {
    ...input,
    id: `demo-lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    poolId,
    buyerNumber: newCount,
    createdAt: new Date().toISOString(),
  };

  leads.push(newLead);
  setStoredJson(DEMO_LEADS_KEY, leads);

  return {
    leadId: newLead.id,
    buyerNumber: newLead.buyerNumber,
    currentBuyers: newCount,
    targetBuyers,
    remainingBuyers: Math.max(0, targetBuyers - newCount),
    alreadyJoined: false,
    poolStatus: status,
  };
}

/**
 * Handles a demo pool request submission in browser localStorage
 */
export function submitDemoRequest(request: Omit<PoolRequest, 'id' | 'createdAt' | 'status' | 'reviewedAt'>): { id: string } {
  const requests = getStoredJson<PoolRequest[]>(DEMO_REQUESTS_KEY, []);
  const newReq: PoolRequest = {
    ...request,
    id: `demo-req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: 'REQUESTED',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  requests.push(newReq);
  setStoredJson(DEMO_REQUESTS_KEY, requests);
  return { id: newReq.id };
}
