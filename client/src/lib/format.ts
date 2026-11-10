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
