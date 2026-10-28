'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldAlert, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export function AdminLoginForm() {
  const router = useRouter();
  const [passkey, setPasskey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!passkey.trim()) {
      setErrorMessage('Please enter your operator passkey.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: passkey.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Authentication failed. Please verify your passkey.');
        return;
      }

      // Success: session cookie set via HTTP-only header, refresh/redirect to /admin
      router.push('/admin');
      router.refresh();
    } catch {
      setErrorMessage('Network error during authentication. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-3xl border border-gray-200/80 shadow-xl p-6 sm:p-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto mb-4 shadow-xs">
          <Lock className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-950 tracking-tight">
          Admin Portal
        </h1>
        <p className="text-xs text-gray-500 mt-1.5">
          Authorized PoolBuy operators only. Enter your server passkey to manage pools and verified leads.
        </p>
      </div>

      {errorMessage && (
        <div
          className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3.5 mb-6 flex items-start gap-2.5"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="admin-passkey" className="block text-xs font-bold text-slate-800 mb-1.5">
            Operator Passkey
          </label>
          <input
            id="admin-passkey"
            type="password"
            required
            autoComplete="current-password"
            value={passkey}
            onChange={(e) => setPasskey(e.target.value)}
            placeholder="••••••••••••••••"
            className="w-full text-sm px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-hidden font-medium transition-all"
          />
        </div>

        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-[11px] text-gray-500 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Access is logged and secured by server-side HMAC session verification. No credentials are saved in browser storage.
          </span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-3.5 rounded-xl bg-gray-950 text-white hover:bg-gray-800 active:scale-98 transition-all shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Verifying Passkey...</span>
            </>
          ) : (
            <>
              <span>Authenticate & Enter</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
