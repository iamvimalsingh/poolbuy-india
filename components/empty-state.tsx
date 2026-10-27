import React from 'react';
import Link from 'next/link';
import { PackageSearch } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'No pools found',
  description = 'Try adjusting your city or category filters, or submit a request for a new pool in your city.',
  actionText,
  actionHref,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 max-w-lg mx-auto">
      <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-4">
        {icon || <PackageSearch className="w-6 h-6 text-gray-400" aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
        {description}
      </p>
      {actionText && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
        >
          {actionText}
        </Link>
      )}
      {actionText && !actionHref && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
