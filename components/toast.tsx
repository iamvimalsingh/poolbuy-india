'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export const DEFAULT_JOIN_SUCCESS_MESSAGE = "Interest registered successfully! We'll update you soon.";

export interface ToastProps {
  message: string;
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({
  message,
  isOpen,
  onClose,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 animate-slide-up bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-medium border border-emerald-500/80 sm:max-w-md shadow-emerald-950/20"
    >
      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-100" aria-hidden="true" />
      <span className="flex-1 leading-snug">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-emerald-700/80 text-emerald-100 hover:text-white transition-colors cursor-pointer shrink-0"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
