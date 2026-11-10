/**
 * Bangladeshi Phone Number Normalizer & Validator
 * Converts equivalent variations (01..., 8801..., +8801..., spaces, dashes, Bengali digits)
 * into a single canonical 11-digit representation (01XXXXXXXXX).
 */

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function normalizeBdPhone(input) {
  if (!input) return '';
  let str = String(input).trim();

  // 1. Replace Bengali numerals with ASCII English numerals
  for (let i = 0; i < 10; i++) {
    if (str.includes(BENGALI_DIGITS[i])) {
      str = str.split(BENGALI_DIGITS[i]).join(String(i));
    }
  }

  // 2. Strip all non-digit characters (spaces, +, -, (, ), etc.)
  const digitsOnly = str.replace(/\D/g, '');

  // 3. Handle 88 prefix: 8801XXXXXXXXX -> 01XXXXXXXXX (13 digits -> 11 digits)
  if (digitsOnly.startsWith('8801') && digitsOnly.length === 13) {
    return digitsOnly.slice(2);
  }

  return digitsOnly;
}

export function isValidBdPhone(input) {
  const normalized = normalizeBdPhone(input);
  // Bangladeshi mobile numbers must be 11 digits, start with 01, followed by operator prefix [3-9]
  return /^01[3-9]\d{8}$/.test(normalized);
}

export default {
  normalizeBdPhone,
  isValidBdPhone
};
