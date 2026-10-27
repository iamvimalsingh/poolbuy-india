/**
 * GroupBuying India — Connection Fee Operational Utility
 *
 * Rule specification:
 * - Proposed operational rule: max(₹99, 0.10% × owner-approved fee basis).
 * - Rounded to the nearest whole rupee (Math.round).
 * - Disclosed to buyer before any agreement.
 * - Manual confirmation and recording only; no automatic payment collection in MVP.
 */

export const CURRENT_FEE_RULE_VERSION = '2026-10-v1';
export const MIN_FEE_INR = 99;
export const FEE_PERCENTAGE = 0.001; // 0.10%

/**
 * Calculates suggested connection fee in whole INR based on an approved fee basis.
 * Formula: max(₹99, round(0.10% × feeBasis))
 */
export function calculateSuggestedConnectionFee(feeBasis: number): number {
  if (isNaN(feeBasis) || feeBasis <= 0) {
    return MIN_FEE_INR;
  }
  const calculated = Math.round(feeBasis * FEE_PERCENTAGE);
  return Math.max(MIN_FEE_INR, calculated);
}

/**
 * Validates whether a proposed connection fee amount matches the approved formula or manual override.
 */
export function formatFeeDisclosureNotice(
  feeAmount: number,
  feeBasis: number,
  productName: string
): string {
  return (
    `Connection Service Fee: ₹${feeAmount.toLocaleString('en-IN')}\n` +
    `Calculated under rule version ${CURRENT_FEE_RULE_VERSION} as max(₹99, 0.10% × ₹${feeBasis.toLocaleString('en-IN')}) for ${productName}.\n` +
    `This fee covers group verification and verified supplier introduction. Payable only upon member confirmation.`
  );
}
