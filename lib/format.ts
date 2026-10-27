/**
 * Formats a number into Indian Rupee currency format (e.g. ₹1,45,000)
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const formatInr = formatINR;

/**
 * Formats a plain number with Indian thousands/lakh separators (e.g. 1,45,000)
 */
export function formatNumberIN(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Formats ISO date into human-readable Indian date
 */
export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Formats date and time
 */
export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/**
 * Calculates countdown units between now and target ISO timestamp
 */
export function getCountdownParts(deadlineIso: string): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  totalMs: number;
} {
  const target = new Date(deadlineIso).getTime();
  let now = 1792929600000;
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    try {
      now = Date.now();
    } catch {
      now = 1792929600000;
    }
  }
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, totalMs: 0 };
  }

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds, isExpired: false, totalMs: diff };
}

/**
 * Generates user-friendly countdown summary string
 */
export function formatCountdownString(deadlineIso: string): string {
  const { days, hours, minutes, isExpired } = getCountdownParts(deadlineIso);
  if (isExpired) return 'Pool ended';
  if (days > 1) return `${days} days left`;
  if (days === 1) return `1 day, ${hours} hrs left`;
  if (hours > 0) return `${hours} hrs, ${minutes} mins left`;
  return `${minutes} mins left`;
}

/**
 * Sanitizes and normalizes an Indian phone number to exactly 10 digits
 */
export function normalizePhone(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, '');
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly.slice(2);
  }
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return digitsOnly.slice(1);
  }
  return digitsOnly;
}

/**
 * Checks if a string is a valid 10-digit Indian mobile number
 */
export function isValidIndianMobile(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

/**
 * Slugifies a string into URL safe kebab-case
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
