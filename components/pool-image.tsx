'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { getPoolFallbackImage } from '@/lib/pool-image-fallback';
import { ShieldCheck } from 'lucide-react';

interface PoolImageProps {
  src?: string | null;
  alt: string;
  category?: string | null;
  categorySlug?: string | null;
  slugOrName?: string | null;
  priority?: boolean;
  className?: string;
  sizes?: string;
  objectFit?: 'cover' | 'contain';
}

export function PoolImage({
  src,
  alt,
  category,
  categorySlug,
  slugOrName,
  priority = false,
  className = '',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  objectFit = 'cover',
}: PoolImageProps) {
  const fallbackSrc = getPoolFallbackImage(category, categorySlug, slugOrName);
  const [failedSrcs, setFailedSrcs] = useState<Record<string, boolean>>({});

  const hasValidPropSrc = Boolean(src && src.trim() !== '');
  const preferredSrc = hasValidPropSrc ? (src as string) : fallbackSrc;

  // Determine current image source based on error history
  let currentSrc = preferredSrc;
  if (failedSrcs[preferredSrc]) {
    currentSrc = fallbackSrc;
  }
  const isFallbackFailed = Boolean(failedSrcs[fallbackSrc]);

  const handleError = () => {
    setFailedSrcs((prev) => ({ ...prev, [currentSrc]: true }));
  };

  if (isFallbackFailed) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-emerald-50 via-slate-50 to-teal-50 text-gray-500 p-4 ${className}`}
        role="img"
        aria-label={alt}
      >
        <ShieldCheck className="w-10 h-10 text-emerald-600 mb-2" aria-hidden="true" />
        <span className="text-xs font-semibold text-gray-800 text-center">PoolBuy India</span>
        <span className="text-[10px] text-gray-500 text-center">Verified Deal</span>
      </div>
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={handleError}
      className={`${objectFit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`}
    />
  );
}
