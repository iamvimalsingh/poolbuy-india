'use client';

import React from 'react';
import {
  Shield,
  DollarSign,
  MessageCircle,
} from 'lucide-react';
import { CURRENT_FEE_RULE_VERSION, MIN_FEE_INR, FEE_PERCENTAGE } from '@/lib/fee';
import { PRIVACY_NOTICE_VERSION } from '@/lib/constants';

export function AdminSettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-950 tracking-tight">Admin & Operational Settings</h2>
        <p className="text-xs text-gray-500 mt-1">
          Reference configuration, fee rule versioning, message templates, and compliance guardrails.
        </p>
      </div>

      {/* Fee Policy Card */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-950">Connection Fee Policy Configuration</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-gray-500">Active Rule Version</div>
            <div className="text-base font-bold text-gray-950 mt-1">{CURRENT_FEE_RULE_VERSION}</div>
            <div className="text-[11px] text-gray-400 mt-1">Owner-approved operational rule</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-gray-500">Calculation Formula</div>
            <div className="text-base font-bold text-emerald-700 mt-1">
              max(₹{MIN_FEE_INR}, {(FEE_PERCENTAGE * 100).toFixed(2)}% × Basis)
            </div>
            <div className="text-[11px] text-gray-400 mt-1">Whole INR rounding</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-gray-500">Payment Gateway Status</div>
            <div className="text-base font-bold text-rose-700 mt-1">DISABLED</div>
            <div className="text-[11px] text-gray-400 mt-1">Manual bank transfer / UPI only</div>
          </div>
        </div>

        <div className="text-xs text-gray-600 bg-gray-50 p-4 rounded-2xl leading-relaxed">
          <strong>Disclosure Requirement:</strong> Every buyer must receive the exact disclosed amount via WhatsApp and give affirmative agreement before any fee payment instruction is issued. Surprise or silent deductions are strictly prohibited.
        </div>
      </div>

      {/* Message Templates Reference */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-950">Operational WhatsApp Message Templates</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-gray-100 bg-slate-50/50">
            <div className="font-bold text-gray-950">1. Target Reached — Quotation Review Invitation</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Invites buyer to review quotes without financial commitment.</div>
          </div>

          <div className="p-3 rounded-xl border border-gray-100 bg-slate-50/50">
            <div className="font-bold text-gray-950">2. Quotation Available — Request Decision</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Requests voluntary INTERESTED / DECLINED decision from member.</div>
          </div>

          <div className="p-3 rounded-xl border border-gray-100 bg-slate-50/50">
            <div className="font-bold text-gray-950">3. Connection Fee Disclosure & Terms</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Discloses exact suggested fee amount before payment request.</div>
          </div>

          <div className="p-3 rounded-xl border border-gray-100 bg-slate-50/50">
            <div className="font-bold text-gray-950">4. Payment Instructions (UPI / UTR)</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Official payment details for manual transfer verification.</div>
          </div>

          <div className="p-3 rounded-xl border border-gray-100 bg-slate-50/50">
            <div className="font-bold text-gray-950">5. Waitlist Capacity Invitation</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Notifies FIFO candidate of available slot with 24-hr expiry.</div>
          </div>

          <div className="p-3 rounded-xl border border-gray-100 bg-slate-50/50">
            <div className="font-bold text-gray-950">6. Exclusion Notice</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Mandatory reason stated when seat is released.</div>
          </div>
        </div>
      </div>

      {/* Compliance & Contact */}
      <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-950">Compliance & Trust Framework</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-gray-500">Privacy Notice Version</div>
            <div className="text-base font-bold text-gray-950 mt-1">{PRIVACY_NOTICE_VERSION}</div>
            <div className="text-[11px] text-gray-400 mt-1">Recorded on all member joins</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-gray-500">Grievance & Legal Officer</div>
            <div className="text-base font-bold text-gray-950 mt-1">support@groupbuying.store</div>
            <div className="text-[11px] text-gray-400 mt-1">Consumer protection compliance contact</div>
          </div>
        </div>
      </div>
    </div>
  );
}
