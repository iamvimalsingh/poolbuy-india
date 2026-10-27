import React from 'react';
import { Users } from 'lucide-react';

interface PoolProgressProps {
  currentBuyers: number;
  targetBuyers: number;
  showDetails?: boolean;
  className?: string;
}

export function PoolProgress({
  currentBuyers,
  targetBuyers,
  showDetails = true,
  className = '',
}: PoolProgressProps) {
  // Defensive bounds checks
  const safeCurrent = Math.max(0, currentBuyers);
  const safeTarget = Math.max(1, targetBuyers);
  const ratio = safeCurrent / safeTarget;
  const percentage = Math.min(Math.max(ratio * 100, 0), 100);
  const remaining = Math.max(0, safeTarget - safeCurrent);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showDetails && (
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-semibold text-gray-800">
            <Users className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
            <span>
              {safeCurrent}{' '}
              <span className="font-normal text-gray-500">/ {safeTarget} joined</span>
            </span>
          </span>

          <span className="font-medium text-gray-600">
            {remaining > 0 ? (
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-100">
                {remaining} more needed
              </span>
            ) : (
              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-blue-100">
                Target Met!
              </span>
            )}
          </span>
        </div>
      )}

      {/* Accessible visual bar */}
      <div
        className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200/60"
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Buyer pool progress: ${safeCurrent} of ${safeTarget} buyers`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            percentage >= 100
              ? 'bg-blue-600'
              : percentage >= 70
              ? 'bg-emerald-500'
              : 'bg-emerald-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
