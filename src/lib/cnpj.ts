/**
 * CNPJ formatting and validation utilities.
 */

/** Apply visual mask: 00.000.000/0000-00 */
export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Validate CNPJ check digits (expects 14 raw digits). */
export function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;

  // Reject all-same-digit sequences
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calc = (slice: string, weights: number[]) =>
    weights.reduce((sum, w, i) => sum + Number(slice[i]) * w, 0);

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(digits, w1) % 11;
  const check1 = d1 < 2 ? 0 : 11 - d1;
  if (Number(digits[12]) !== check1) return false;

  const d2 = calc(digits, w2) % 11;
  const check2 = d2 < 2 ? 0 : 11 - d2;
  if (Number(digits[13]) !== check2) return false;

  return true;
}
