const fcfaFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** 150000 → « 150 000 FCFA » (espaces insécables normalisés en espaces simples). */
export function formatFcfa(amount: number): string {
  return `${fcfaFormatter.format(Math.round(amount)).replace(/[\u202f\u00a0]/g, ' ')} FCFA`;
}

/** Numéro ivoirien : +225 suivi de 10 chiffres. */
export const CI_PHONE_REGEX = /^\+225\d{10}$/;

/** Normalise une saisie libre (« 07 07 12 34 56 », « 002250707123456 »…) vers +225XXXXXXXXXX. */
export function normalizeCiPhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('00225')) digits = `+225${digits.slice(5)}`;
  else if (!digits.startsWith('+')) digits = digits.length === 10 ? `+225${digits}` : `+${digits}`;
  return CI_PHONE_REGEX.test(digits) ? digits : null;
}

/** +2250707123456 → « +225 07 07 12 34 56 ». */
export function formatCiPhone(phone: string): string {
  if (!CI_PHONE_REGEX.test(phone)) return phone;
  const local = phone.slice(4);
  return `+225 ${local.match(/.{2}/g)?.join(' ') ?? local}`;
}

/** Référence séquentielle : formatReference('DEV', 2026, 7) → « DEV-2026-0007 ». */
export function formatReference(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}
