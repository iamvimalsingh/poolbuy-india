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
 * Message Template 1: Pool Unlocked — Refundable Token Payment Link
 * Available ONLY when pool is UNLOCKED and dealer terms / token URL are verified.
 */
export function buildUnlockedPoolMessage(
  buyerName: string,
  pool: AdminPool,
  tokenPaymentUrl: string,
  tokenAmount: number
): string {
  const tokenFormatted = formatINR(tokenAmount);
  return (
    `Namaste ${buyerName.trim()},\n\n` +
    `Great news! The group-buy pool for *${pool.name}* in ${pool.city} has reached its buyer target. ` +
    `We have verified the group quotation and delivery terms with authorized dealership *${pool.dealerName || 'our dealer partner'}*.\n\n` +
    `To confirm your allocation, please complete your fully refundable token deposit of *${tokenFormatted}* using this official link:\n` +
    `${tokenPaymentUrl}\n\n` +
    `*Note:* This token is 100% refundable as per dealer terms if you choose not to proceed before final showroom invoicing.`
  );
}

/**
 * Message Template 2: Lead Fallback — Direct Showroom Quotation
 * Used when a pool did not unlock or is routed to lead fallback with buyer consent.
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
 * Message Template 4: Target Reached / Connection Stage Invitation
 * Sent by admin click-to-chat to invite buyer to review verified group quotation.
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
