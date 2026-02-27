/**
 * Number formatting utilities
 * Rules: comma every 3 digits, max 2 decimal places, round before format
 */

export function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || isNaN(n as number)) return '—';
  const d = Math.min(decimals, 2);
  const factor = Math.pow(10, d);
  const rounded = Math.round((n as number) * factor) / factor;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
}

export function fmtCurrency(n: number | null | undefined, decimals = 2): string {
  if (!n && n !== 0) return '—';
  if ((n as number) === 0) return '$0';
  return '$' + fmtNum(n, decimals);
}

export function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || isNaN(n as number)) return '—';
  const d = Math.min(decimals, 2);
  const factor = Math.pow(10, d);
  const rounded = Math.round((n as number) * factor) / factor;
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  }) + '%';
}
