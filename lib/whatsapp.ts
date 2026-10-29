import { PublicPool, AdminPool } from '@/types';
import { normalizePhone, formatINR } from './format';
import { getSiteUrl } from './seo';

/**
 * Constructs a safe https://wa.me/ URL for WhatsApp messaging.
 * Ensures the phone number is a normalized 10-digit number prefixed with 91.
 */
export function buildWhatsAppDirectUrl(rawPhone: string, messageText: string): string {
  const normalized = normalizePhone(rawPhone);
  const encodedText = encodeURIComponent(messageText);
  return `https://wa.me/91${normalized}?text=${encodedText}`;
}

/**
 * Constructs a safe WhatsApp viral share link for buyers after joining a pool.
 * Does NOT contain buyer personal information or unsupported discount guarantees.
 */
export function buildBuyerViralShareUrl(pool: PublicPool, siteUrl?: string): string {
  const base = (siteUrl || getSiteUrl()).replace(/\/+$/, '');
  const dealUrl = `${base}/deals/${pool.citySlug}/${pool.slug}`;

  const message =
    `Main ${pool.city} mein ${pool.name} ke GroupBuying.store group deal mein interest register kar chuka/chuki hoon. ` +
    `Target hit hone par dealer se bulk-price terms verify hongi. Details: ${dealUrl}`;

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Message Template: Pool Unlocked — Refundable Token Payment Link
 */
export function buildUnlockedPoolMessage(
  buyerName: string,
  pool: AdminPool,
  coordinationUrl?: string
): string {
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `Great news! The group-buy pool for *${pool.name}* in ${pool.city} has reached its buyer target. ` +
    `We have verified the bulk group quotation and delivery terms with authorized local partner *${pool.dealerName || 'our verified partner'}*.\n\n` +
    `Our team will now coordinate direct introductions between verified buyers and the authorized supplier.\n` +
    (coordinationUrl ? `You can review verified deal specifications here:\n${coordinationUrl}\n\n` : '') +
    `*Note:* GroupBuying collects zero platform fees — all invoicing, warranty, and delivery remain 100% direct with the authorized partner.`
  );
}

/**
 * Message Template: Lead Fallback — Direct Showroom Quotation
 */
export function buildLeadFallbackMessage(
  buyerName: string,
  poolName: string,
  cityName: string,
  dealerName?: string
): string {
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `Regarding your registered interest in *${poolName}* in ${cityName}: ` +
    `While the group threshold was not unlocked, our verified dealership partner${dealerName ? ` (*${dealerName}*)` : ''} ` +
    `has prepared an exclusive direct quotation for your review.\n\n` +
    `Would you like us to share the details and arrange a test drive/consultation?`
  );
}

export function buildQuoteFollowupMessage(
  buyerName: string,
  productName: string,
  cityName: string
): string {
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `Thank you for joining the GroupBuying group for *${productName}* in ${cityName}.\n\n` +
    `You mentioned you already have an existing quotation. If you'd like to voluntarily share your current quoted price, ` +
    `our team will verify if our bulk dealership terms can beat or match it.`
  );
}

/**
 * Message Template: Target Reached / Connection Stage Invitation
 */
export function buildTargetReachedMessage(
  buyerName: string,
  productName: string,
  cityName: string,
  targetBuyers: number
): string {
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `Great news! The group buy for *${productName}* in ${cityName} has reached its buyer target of ${targetBuyers} members on GroupBuying.\n\n` +
    `Our team is currently reviewing vendor quotations to verify pricing and delivery terms. ` +
    `We will share the verified options for your confirmation shortly before connecting you with the supplier.\n\n` +
    `There is no payment or commitment required at this stage.`
  );
}

/**
 * Message Template: Group Published
 */
export function buildGroupPublishedMessage(
  buyerName: string,
  productName: string,
  cityName: string,
  targetBuyers: number,
  deadline: string
): string {
  const formattedDeadline = new Date(deadline).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `The group buy for *${productName}* in ${cityName} is now officially published on GroupBuying.store!\n\n` +
    `Target: ${targetBuyers} buyers. Group closes on: ${formattedDeadline}.\n` +
    `You can track group progress in real time. We will update you as soon as the cohort reaches capacity.`
  );
}

/**
 * Message Template: Quote Available
 */
export function buildQuoteAvailableMessage(
  buyerName: string,
  productName: string,
  cityName: string,
  vendorQuotedPrice: number,
  validUntil: string
): string {
  const priceFormatted = formatINR(vendorQuotedPrice);
  const formattedExpiry = new Date(validUntil).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `A verified vendor quotation is now available for *${productName}* in ${cityName}!\n\n` +
    `Quoted Group Price: *${priceFormatted}*\n` +
    `Valid until: ${formattedExpiry}\n\n` +
    `Please reply with:\n` +
    `1. *INTERESTED* — if you would like to proceed at this quotation.\n` +
    `2. *DECLINED* — if this quote does not meet your requirements.\n\n` +
    `This inquiry does not obligate you to purchase.`
  );
}

/**
 * Message Template: Response Reminder
 */
export function buildResponseReminderMessage(
  buyerName: string,
  productName: string,
  cityName: string
): string {
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `Friendly reminder regarding the group quotation for *${productName}* in ${cityName}.\n\n` +
    `To finalize the group count and reserve supplier allocation, please let us know if you wish to proceed (*INTERESTED*) or opt out (*DECLINED*).\n\n` +
    `If you need additional scope or specification details, simply reply here.`
  );
}

/**
 * Message Template: Connection Fee Disclosure
 */
export function buildConnectionFeeDisclosureMessage(
  buyerName: string,
  productName: string,
  cityName: string,
  feeAmount?: number,
  feeBasis?: number
): string {
  if (feeAmount && feeBasis) {
    const feeFormatted = formatINR(feeAmount);
    const basisFormatted = formatINR(feeBasis);
    return (
      `Namaste ${buyerName.trim()},\n\n` +
      `The group for *${productName}* in ${cityName} is preparing for direct supplier introduction.\n\n` +
      `As per our terms, the connection fee for this group is *${feeFormatted}* (calculated as max(₹99, 0.10% × approved basis of ${basisFormatted})).\n\n` +
      `This fee covers supplier verification, delivery coordination, and group representation.\n` +
      `Please confirm if you agree to these disclosed terms to receive payment instructions.`
    );
  }
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `The group for *${productName}* in ${cityName} is preparing for direct supplier introduction.\n\n` +
    `As per our terms, GroupBuying collects zero platform charges in MVP. ` +
    `All invoicing and warranty terms are issued directly by the authorized local supplier.\n\n` +
    `Please reply with *READY* to receive direct dealer contact and scheduling details.`
  );
}

/**
 * Message Template: Payment Instructions
 */
export function buildPaymentInstructionsMessage(
  buyerName: string,
  productName: string,
  partnerOrAmount?: string | number,
  coordinationDetails?: string
): string {
  const partnerName = typeof partnerOrAmount === 'string' ? partnerOrAmount : 'Authorized Local Supplier';
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `Direct supplier coordination details for *${productName}* (${partnerName}):\n\n` +
    `${coordinationDetails || 'The authorized dealer will contact you directly for site inspection and official invoicing.'}\n\n` +
    `Reminder: GroupBuying collects zero platform fees. Product purchase and invoicing remain directly between you and the verified supplier.`
  );
}

/**
 * Message Template: Waitlist Invitation
 */
export function buildWaitlistInvitationMessage(
  buyerName: string,
  productName: string,
  cityName: string,
  position: number
): string {
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `Good news! A capacity slot has opened up in the *${productName}* group in ${cityName}.\n\n` +
    `As position #${position} on the waitlist, you are now invited to take this allocation.\n\n` +
    `Please reply with *ACCEPT* within 24 hours to confirm your seat in the active buying group, or *PASS* to release it to the next buyer.`
  );
}

/**
 * Message Template: Waitlist Promotion Confirmation
 */
export function buildWaitlistPromotionMessage(
  buyerName: string,
  productName: string,
  cityName: string,
  buyerNumber: number
): string {
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `You have been successfully promoted from the waitlist to an active member (Buyer #${buyerNumber}) in the *${productName}* group in ${cityName}!\n\n` +
    `You will receive all group quotation and supplier connection updates directly on WhatsApp.`
  );
}

/**
 * Message Template: Exclusion Notice
 */
export function buildExclusionNoticeMessage(
  buyerName: string,
  productName: string,
  cityName: string,
  reason: string
): string {
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `This is an update regarding your registration in *${productName}* in ${cityName}.\n\n` +
    `Your seat has been released from the active group for the following reason: ${reason}.\n\n` +
    `If you believe this was in error, please reply to this message and our admin team will review it.`
  );
}

/**
 * Message Template: Group Completed
 */
export function buildGroupCompletedMessage(
  buyerName: string,
  productName: string,
  cityName: string
): string {
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `The group buy round for *${productName}* in ${cityName} has concluded successfully!\n\n` +
    `All participating members have been connected with the supplier. Thank you for participating in community group buying with GroupBuying.store.`
  );
}

/**
 * Message Template: Opt-out Confirmation
 */
export function buildOptOutConfirmationMessage(
  buyerName: string,
  productName: string
): string {
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `As requested, your contact preferences have been updated to DO NOT CONTACT for *${productName}*.\n\n` +
    `You will receive no further messages or calls regarding this group. Thank you.`
  );
}
