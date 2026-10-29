'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  PoolShareData,
  buildPoolShareContent,
  triggerNativeShare,
  copyShareLinkToClipboard,
} from '@/lib/sharing';

interface SharePoolModalProps {
  pool: PoolShareData;
  isOpen: boolean;
  onClose: () => void;
}

export function SharePoolModal({ pool, isOpen, onClose }: SharePoolModalProps) {
  const [copied, setCopied] = useState(false);
  const [hasNativeShare] = useState(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function');

  const shareContent = buildPoolShareContent(pool);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    const success = await copyShareLinkToClipboard(shareContent.url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    const res = await triggerNativeShare({
      title: shareContent.title,
      text: shareContent.text,
      url: shareContent.url,
    });
    if (res === 'SHARED') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-pool-title"
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Share2 className="w-4 h-4" />
              </div>
              <h3 id="share-pool-title" className="text-base font-extrabold text-gray-950">
                Share This Pool
              </h3>
            </div>
            <p className="text-xs text-gray-500">
              Invite friends or neighbors in {pool.city} to help reach the buyer target faster.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pool Summary Pill */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-xs text-gray-900 truncate">
              {pool.productTitle || pool.name}
            </span>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
              {pool.city}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>100% Free &amp; Non-Binding Registration of Interest</span>
          </div>
        </div>

        {/* Message Preview Box */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
            Share Message Preview
          </label>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 font-normal leading-relaxed select-all">
            {shareContent.fullMessage}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* WhatsApp Direct Share */}
          <a
            href={shareContent.whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-[#25D366] hover:bg-[#1EBE5D] text-white transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Share on WhatsApp</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
          </a>

          {/* Copy Link */}
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 transition-all shadow-2xs cursor-pointer active:scale-98"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700 font-extrabold">Link Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-gray-500" />
                <span>Copy Shareable Link</span>
              </>
            )}
          </button>

          {/* Native Web Share Button (if supported on mobile/tablet) */}
          {hasNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>More Sharing Options (System Dialog)</span>
            </button>
          )}
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-gray-400 text-center leading-normal">
          Shared link includes clean referral tags only. No personal information or contact details are transmitted.
        </p>
      </div>
    </div>
  );
}
