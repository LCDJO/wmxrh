/**
 * Automated Hiring — Brazilian Document Validators
 *
 * Pure functions for CPF and PIS/PASEP validation
 * following official algorithms (Receita Federal / Caixa Econômica).
 */

/**
 * Validate a Brazilian CPF number.
 * Algorithm: two check digits using mod-11 with weights.
 */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;

  // Reject known invalid sequences (all same digit)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;

  return true;
}

/**
 * Validate a Brazilian PIS/PASEP/NIT number.
 * Algorithm: single check digit using mod-11 with weights [3,2,9,8,7,6,5,4,3,2].
 */
export function isValidPIS(pis: string): boolean {
  const digits = pis.replace(/\D/g, '');
  if (digits.length !== 11) return false;

  // Reject all-zero
  if (digits === '00000000000') return false;

  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * weights[i];
  }
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;

  return checkDigit === parseInt(digits[10]);
}

/**
 * Format CPF as XXX.XXX.XXX-XX
 */
export function formatCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '').padStart(11, '0');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/**
 * Format PIS as XXX.XXXXX.XX-X
 */
export function formatPIS(pis: string): string {
  const d = pis.replace(/\D/g, '').padStart(11, '0');
  return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8, 10)}-${d.slice(10)}`;
}
