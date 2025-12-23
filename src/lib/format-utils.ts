/**
 * Smart number formatting utility
 * - Always uses comma for thousands separator (1,000 / 10,000 / 1,000,000)
 * - Rounds numbers intelligently based on context
 */
export const formatNumber = (num: number, decimals: number = 0): string => {
  if (num === 0) return '0';
  if (isNaN(num) || !isFinite(num)) return '0';

  let rounded: number;

  // Round based on decimal places requested
  if (decimals === 0) {
    rounded = Math.round(num);
  } else if (decimals === 1) {
    rounded = Math.round(num * 10) / 10;
  } else if (decimals === 2) {
    rounded = Math.round(num * 100) / 100;
  } else {
    rounded = Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  // Format with comma separators for thousands
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format currency (always shows $ and commas)
 */
export const formatCurrency = (num: number, decimals: number = 0): string => {
  if (num === 0) return '$0';
  if (isNaN(num) || !isFinite(num)) return '$0';

  return '$' + formatNumber(num, decimals);
};

/**
 * Format percentage (adds % suffix)
 */
export const formatPercent = (num: number, decimals: number = 1): string => {
  if (num === 0) return '0%';
  if (isNaN(num) || !isFinite(num)) return '0%';

  return formatNumber(num, decimals) + '%';
};
