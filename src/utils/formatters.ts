/**
 * Formats a numeric value into Brazilian Real (BRL) currency string safely without throwing TypeError.
 */
export function formatBRL(val: number | null | undefined): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

/**
 * Formats a plain number with 2 decimal places safely.
 */
export function formatPrice(val: number | null | undefined): string {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return num.toFixed(2).replace('.', ',');
}

