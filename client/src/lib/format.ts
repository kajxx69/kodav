import { formatFcfa, type DurationUnit, type Service } from '@kodav/shared';

/** « À partir de 250 000 FCFA », « À partir de 15 000 FCFA / heure » ou « Sur devis ». */
export function priceLabel(service: Pick<Service, 'pricingMode' | 'priceMin' | 'unitLabel'>) {
  if (service.pricingMode === 'sur_devis' || service.priceMin === undefined) return 'Sur devis';
  const unit =
    service.pricingMode === 'par_unite' && service.unitLabel ? ` / ${service.unitLabel}` : '';
  return `À partir de ${formatFcfa(service.priceMin)}${unit}`;
}

const unitLabels: Record<DurationUnit, [string, string]> = {
  heure: ['heure', 'heures'],
  jour: ['jour', 'jours'],
  semaine: ['semaine', 'semaines'],
};

/** { min: 1, max: 3, unit: 'semaine' } → « 1 à 3 semaines ». */
export function durationLabel({ min, max, unit }: Service['estimatedDuration']) {
  const [singular, plural] = unitLabels[unit];
  if (min === max) return `${min} ${min > 1 ? plural : singular}`;
  return `${min} à ${max} ${max > 1 ? plural : singular}`;
}

/** Lien WhatsApp avec message pré-rempli, ou null si le numéro n'est pas encore renseigné. */
export function whatsappLink(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '');
  if (!/^225\d{10}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function telLink(phone: string) {
  return /^\+225\d{10}$/.test(phone) ? `tel:${phone}` : null;
}

const numberFormat = new Intl.NumberFormat('fr-FR');

/** { min: 390000, max: 770000 } → « 390 000 – 770 000 FCFA ». */
export function rangeLabel({ min, max }: { min: number; max: number }) {
  return min === max ? formatFcfa(min) : `${numberFormat.format(min)} – ${formatFcfa(max)}`;
}

/** Pluriel simple des unités du catalogue (« poste » → « postes »). */
export function plural(word: string, count: number) {
  return count > 1 && word && !/[sxz]$/.test(word) ? `${word}s` : word;
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Africa/Abidjan',
});
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Abidjan',
});

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
