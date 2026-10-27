'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { Clock } from 'lucide-react';
import { formatCountdownString, getCountdownParts } from '@/lib/format';

interface CountdownProps {
  deadline: string;
  className?: string;
  showIcon?: boolean;
}

const emptySubscribe = () => () => {};

function useHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export function Countdown({ deadline, className = '', showIcon = true }: CountdownProps) {
  const isHydrated = useHydrated();
  const [, setTick] = useState(0);

  useEffect(() => {
    // Tick once every 60 seconds to refresh the countdown
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!isHydrated) {
    // Stable placeholder during SSR/prerender without invoking Date.now()
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] text-gray-500 font-medium ${className}`}>
        {showIcon && <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden="true" />}
        <span>Active Pool</span>
      </span>
    );
  }

  const timeString = formatCountdownString(deadline);
  const { isExpired } = getCountdownParts(deadline);

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
        isExpired ? 'text-amber-700' : 'text-gray-600'
      } ${className}`}
    >
      {showIcon && <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden="true" />}
      <span>{timeString}</span>
    </span>
  );
}
