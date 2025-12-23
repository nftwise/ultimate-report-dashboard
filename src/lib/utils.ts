import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TimeRange } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatNumber(num: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatPercentage(num: number, decimals = 2): string {
  return `${formatNumber(num, decimals)}%`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

export function getTimeRangeDates(period: string): TimeRange {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const endDate = yesterday.toISOString().split('T')[0];

  let startDate: string;

  switch (period) {
    case 'today':
      startDate = today.toISOString().split('T')[0];
      break;
    case '7days':
      const sevenDaysAgo = new Date(yesterday);
      sevenDaysAgo.setDate(yesterday.getDate() - 6);
      startDate = sevenDaysAgo.toISOString().split('T')[0];
      break;
    case '30days':
      const thirtyDaysAgo = new Date(yesterday);
      thirtyDaysAgo.setDate(yesterday.getDate() - 29);
      startDate = thirtyDaysAgo.toISOString().split('T')[0];
      break;
    case '90days':
      const ninetyDaysAgo = new Date(yesterday);
      ninetyDaysAgo.setDate(yesterday.getDate() - 89);
      startDate = ninetyDaysAgo.toISOString().split('T')[0];
      break;
    default:
      startDate = endDate;
  }

  return {
    startDate,
    endDate,
    period: period as any,
  };
}

export function formatPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phoneNumber;
}

/**
 * Get the previous period date range for comparison
 */
export function getPreviousPeriodDates(currentStartDate: string, currentEndDate: string): TimeRange {
  const current_start = new Date(currentStartDate);
  const current_end = new Date(currentEndDate);

  const durationMs = current_end.getTime() - current_start.getTime();
  const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

  const prev_end = new Date(current_start);
  prev_end.setDate(prev_end.getDate() - 1);

  const prev_start = new Date(prev_end);
  prev_start.setDate(prev_start.getDate() - durationDays);

  const startDate = prev_start.toISOString().split('T')[0];
  const endDate = prev_end.toISOString().split('T')[0];

  console.log(`📊 [Utils] Previous period calculation:
    Current: ${currentStartDate} to ${currentEndDate} (${durationDays + 1} days)
    Previous: ${startDate} to ${endDate} (${durationDays + 1} days)`);

  return {
    startDate,
    endDate,
    period: 'custom' as any,
  };
}

/**
 * Calculate percentage change between current and previous values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

export function createCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((result, key) => {
      result[key] = params[key];
      return result;
    }, {} as Record<string, any>);

  return `${prefix}_${JSON.stringify(sortedParams)}`;
}
