/**
 * RFC 4180 compliant CSV generator with spreadsheet formula injection protection.
 */

/**
 * Neutralizes potential formula injection characters (=, +, -, @, \t, \r).
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Formula injection neutralization: prefix dangerous characters with an apostrophe
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousPrefixes.some((p) => str.startsWith(p))) {
    str = `'${str}`;
  }

  // RFC 4180 escaping: if cell contains quotes, commas, or newlines, wrap in quotes and double internal quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

// Alias for escapeCsvCell
export const escapeCsvCell = sanitizeCsvCell;

/**
 * Generates full CSV content string with UTF-8 BOM and RFC 4180 formatting
 */
export function generateCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const rowLines = rows.map((row) => row.map(sanitizeCsvCell).join(','));

  // UTF-8 BOM (\uFEFF) ensures proper decoding in Microsoft Excel
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Builds RFC-4180 CSV string for leads array
 */
export function buildLeadsCsv(leads: Array<{
  buyerNumber: number;
  fullName: string;
  whatsappNumber: string;
  city: string;
  buyingTimeline: string;
  hasExistingQuote: boolean;
  existingQuoteAmount: number | null;
  extraMessage: string;
  status: string;
  createdAt: string;
}>): string {
  const headers = [
    'Buyer #',
    'Full Name',
    'WhatsApp Number',
    'City',
    'Buying Timeline',
    'Has Quote',
    'Quote Amount',
    'Extra Message',
    'Status',
    'Created At',
  ];

  const rows = leads.map((l) => [
    l.buyerNumber,
    l.fullName,
    l.whatsappNumber,
    l.city,
    l.buyingTimeline,
    l.hasExistingQuote ? 'YES' : 'NO',
    l.existingQuoteAmount || '',
    l.extraMessage,
    l.status,
    l.createdAt,
  ]);

  return generateCsv(headers, rows);
}
