import React from 'react';
import { AlertCircle } from 'lucide-react';
import { isDemoMode } from '@/lib/data-mode';

export function DemoBanner() {
  if (!isDemoMode()) {
    return null;
  }

  return (
    <aside
      aria-label="Demo environment notice"
      className="bg-amber-500 text-amber-950 border-b border-amber-600 px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-950" aria-hidden="true" />
          <span>
            <strong>Demo Mode:</strong> Demo data — not a live dealer offer. Submissions are saved locally for demonstration purposes only.
          </span>
        </div>
        <span className="hidden md:inline-block text-[11px] bg-amber-600/30 text-amber-950 px-2 py-0.5 rounded font-mono">
          MOCK DATA
        </span>
      </div>
    </aside>
  );
}
