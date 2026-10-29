'use client';

import { useState } from 'react';
import { PublicPool } from '@/types';
import { JoinPoolModal } from './join-pool-modal';
import { PoolProgress } from './pool-progress';
import { Countdown } from './countdown';
import { formatInr } from '@/lib/format';
import { Toast, DEFAULT_JOIN_SUCCESS_MESSAGE } from './toast';
import { SharePoolButton } from './share-pool-button';

interface DealActionPanelProps {
  pool: PublicPool;
}

export function DealActionPanel({ pool }: DealActionPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localJoinedCount, setLocalJoinedCount] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentBuyers = localJoinedCount !== null ? localJoinedCount : pool.currentBuyers;

  const isClosed = pool.status === 'CLOSED';
  const isFallback = pool.status === 'LEAD_FALLBACK';
  const isUnlocked = pool.status === 'UNLOCKED';
  const isActive = pool.status === 'ACTIVE';

  const remaining = Math.max(0, pool.targetBuyers - currentBuyers);

  const handleJoinSuccess = (result: { currentBuyers: number }) => {
    setLocalJoinedCount(result.currentBuyers);
    setToastMessage(DEFAULT_JOIN_SUCCESS_MESSAGE);
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-20">
        {/* Pricing Box */}
        <div className="pb-6 border-b border-slate-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Group Buying Target Price
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              {pool.groupPrice ? formatInr(pool.groupPrice) : 'Price on Target'}
            </span>
            {pool.marketPrice && pool.groupPrice && pool.groupPrice < pool.marketPrice && (
              <span className="text-sm sm:text-base text-slate-400 line-through">
                {formatInr(pool.marketPrice)}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            {pool.priceIsVerified ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                ✓ Verified Dealer Quotation
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                ⚠ Indicative estimate — final price may differ
              </span>
            )}
          </div>

          {/* Verified Vendor Volume Tiers */}
          {pool.priceTiers && pool.priceTiers.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Approved Volume Discount Tiers
              </div>
              <div className="space-y-1.5">
                {pool.priceTiers.map((tier) => (
                  <div key={tier.id} className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="font-medium text-slate-700 block">
                        {tier.minQuantity}{tier.maxQuantity ? `–${tier.maxQuantity}` : '+'} Buyers Cohort
                      </span>
                      {tier.vendorName && (
                        <span className="text-[10px] text-slate-400 block">
                          Partner: {tier.vendorName}
                        </span>
                      )}
                    </div>
                    <span className="font-extrabold text-emerald-700">
                      {formatInr(tier.pricePerUnit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Progress and Countdown */}
        <div className="py-6 border-b border-slate-100 space-y-4">
          <PoolProgress
            currentBuyers={currentBuyers}
            targetBuyers={pool.targetBuyers}
          />

          <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="font-medium text-slate-700">Pool Ends In:</span>
            <Countdown deadline={pool.deadline} />
          </div>

          {remaining > 0 && isActive && (
            <p className="text-xs text-slate-600 text-center font-medium">
              Only <strong className="text-emerald-700">{remaining} more verified buyers</strong> needed in {pool.city} to trigger bulk negotiation!
            </p>
          )}
        </div>

        {/* CTA Button */}
        <div className="pt-6 space-y-3">
          {isActive && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full py-4 px-6 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 shadow-md transition-all text-base"
            >
              Join Pool for Free →
            </button>
          )}

          {isUnlocked && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-center">
              <div className="text-sm font-bold text-blue-900">
                Deal Unlocked! Target Met
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Verified supplier quotation is active. Registered members will receive connection and coordination instructions via WhatsApp.
              </p>
            </div>
          )}

          {isFallback && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <div className="text-sm font-bold text-amber-900">
                Dealer Direct Quotation Mode
              </div>
              <p className="text-xs text-amber-700 mt-1">
                This pool is being routed directly to partnered brand dealerships for bespoke offers.
              </p>
            </div>
          )}

          {isClosed && (
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-center">
              <div className="text-sm font-bold text-slate-700">
                This Pool Has Concluded
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Registrations for this batch are closed. Browse active pools for the next round.
              </p>
            </div>
          )}

          {/* Share Pool Button */}
          <div className="pt-1">
            <SharePoolButton
              pool={{
                name: pool.name,
                city: pool.city,
                citySlug: pool.citySlug,
                slug: pool.slug,
                marketPrice: pool.marketPrice,
                groupPrice: pool.groupPrice,
                priceIsVerified: pool.priceIsVerified,
                currentBuyers,
                targetBuyers: pool.targetBuyers,
              }}
              variant="outline"
              label="Share Pool with Friends"
            />
          </div>

          {/* Trust Guarantees */}
          <ul className="pt-3 space-y-2 text-xs text-slate-500">
            <li className="flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>100% Free:</strong> No upfront payment or card details required</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>No Spam:</strong> WhatsApp updates only for this specific deal</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span><strong>Official Fulfillment:</strong> Delivered by certified brand dealer in {pool.city}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Join Pool Modal */}
      {isModalOpen && (
        <JoinPoolModal
          pool={{ ...pool, currentBuyers }}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={handleJoinSuccess}
        />
      )}

      {/* Premium Success Notification Toast */}
      <Toast
        message={toastMessage || ''}
        isOpen={Boolean(toastMessage)}
        onClose={() => setToastMessage(null)}
      />
    </>
  );
}
