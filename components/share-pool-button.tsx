'use client';

import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { PoolShareData } from '@/lib/sharing';
import { SharePoolModal } from './share-pool-modal';

interface SharePoolButtonProps {
  pool: PoolShareData;
  variant?: 'icon' | 'compact' | 'outline' | 'full';
  className?: string;
  label?: string;
}

export function SharePoolButton({
  pool,
  variant = 'compact',
  className = '',
  label = 'Share',
}: SharePoolButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getButtonStyles = () => {
    switch (variant) {
      case 'icon':
        return 'p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer border border-transparent hover:border-gray-200';
      case 'compact':
        return 'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-2xs cursor-pointer active:scale-98';
      case 'outline':
        return 'w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 transition-all shadow-2xs cursor-pointer active:scale-98';
      case 'full':
        return 'w-full inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 transition-all shadow-2xs cursor-pointer active:scale-98';
      default:
        return 'inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 cursor-pointer';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        aria-label={`Share ${pool.productTitle || pool.name} in ${pool.city}`}
        title={`Share pool in ${pool.city}`}
        className={`${getButtonStyles()} ${className}`}
      >
        <Share2 className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
        {variant !== 'icon' && <span>{label}</span>}
      </button>

      {isOpen && (
        <SharePoolModal
          pool={pool}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
