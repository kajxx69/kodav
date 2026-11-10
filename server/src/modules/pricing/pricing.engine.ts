import type {
  DurationUnit,
  Estimate,
  EstimateLine,
  InterventionMode,
  Range,
  ServiceOption,
} from '@kodav/shared';
import { AppError } from '../../lib/http.js';

export type PricedService = {
  id: string;
  name: string;
  slug: string;
  categorySlug: string;
  pricingMode: 'forfait' | 'par_unite' | 'sur_devis';
  unitLabel?: string;
  priceMin?: number;
  priceMax?: number;
  isPlaceholderPrice: boolean;
  options: ServiceOption[];
  estimatedDuration: { min: number; max: number; unit: DurationUnit };
};

export type PricingRules = {
  urgency: { key: string; label: string; percent: number }[];
  travel: { commune: string; fee: number }[];
  volumeDiscount: { minQuantity: number; percent: number }[];
};

export type EngineInput = {
  items: { service: PricedService; quantity: number; options: Record<string, unknown> }[];
  urgency: string;
  mode: InterventionMode;
  commune?: string;
};

const ZERO: Range = { min: 0, max: 0 };
const add = (a: Range, b: Range): Range => ({ min: a.min + b.min, max: a.max + b.max });
const scale = (r: Range, factor: number): Range => ({ min: r.min * factor, max: r.max * factor });

/** Arrondi commercial au multiple de 500 FCFA : vers le bas pour le min, vers le haut pour le max. */
const ROUND = 500;
const roundRange = (r: Range): Range => ({
  min: Math.floor(r.min / ROUND) * ROUND,
  max: Math.ceil(r.max / ROUND) * ROUND,
});

function invalidOption(service: PricedService, option: ServiceOption, message: string) {
  return AppError.badRequest(`${service.name} : ${option.label.toLowerCase()} ${message}`);
}

/** Impact d'une option sur la ligne (base = prix de la ligne hors options). */
function optionImpact(
  service: PricedService,
  option: ServiceOption,
  raw: unknown,
  base: Range,
  quantity: number,
): { impact: Range; display: string | null } {
  const value = raw ?? option.default;
  const perUnit = (r: Range) => (option.perUnit ? scale(r, quantity) : r);
  const apply = (impact: ServiceOption['impact'], times = 1): Range => {
    if (!impact) return ZERO;
    if (impact.kind === 'percent') {
      return {
        min: (base.min * impact.min * times) / 100,
        max: (base.max * impact.max * times) / 100,
      };
    }
    return perUnit(scale({ min: impact.min, max: impact.max }, times));
  };

  switch (option.type) {
    case 'boolean': {
      if (value === undefined || value === false) return { impact: ZERO, display: null };
      if (value !== true) throw invalidOption(service, option, 'doit être oui ou non');
      return { impact: apply(option.impact), display: 'Oui' };
    }
    case 'select': {
      if (value === undefined || value === '') return { impact: ZERO, display: null };
      const choice = option.choices?.find((c) => c.value === value);
      if (!choice) throw invalidOption(service, option, ': choix inconnu');
      return { impact: apply(choice.impact), display: choice.label };
    }
    case 'number': {
      const n = value === undefined ? 0 : Number(value);
      if (!Number.isInteger(n)) throw invalidOption(service, option, 'doit être un nombre entier');
      if (
        (option.min !== undefined && n < option.min) ||
        (option.max !== undefined && n > option.max)
      ) {
        throw invalidOption(service, option, `doit être entre ${option.min ?? 0} et ${option.max}`);
      }
      if (n === 0) return { impact: ZERO, display: null };
      // Le nombre saisi multiplie l'impact (ex. 3 pages × 25 000) ; pas de multiplication par la quantité.
      const impact = option.impact;
      const range =
        impact?.kind === 'percent'
          ? { min: (base.min * impact.min * n) / 100, max: (base.max * impact.max * n) / 100 }
          : impact
            ? { min: impact.min * n, max: impact.max * n }
            : ZERO;
      return { impact: range, display: String(n) };
    }
  }
}

const UNIT_RANK: Record<DurationUnit, number> = { heure: 0, jour: 1, semaine: 2 };

/**
 * Estimation d'une demande : source de vérité unique des prix affichés au client.
 * Ordre : lignes (+ options) → remise volume par ligne → majoration d'urgence → déplacement.
 */
export function computeEstimate(input: EngineInput, rules: PricingRules): Estimate {
  const lines: EstimateLine[] = [];
  let subtotal = ZERO;
  let volumeDiscount = ZERO;
  let duration: Estimate['duration'] = null;

  for (const { service, quantity, options } of input.items) {
    const knownKeys = new Set(service.options.map((o) => o.key));
    for (const key of Object.keys(options)) {
      if (!knownKeys.has(key))
        throw AppError.badRequest(`${service.name} : option inconnue (${key})`);
    }

    const onQuote = service.pricingMode === 'sur_devis';
    const qty = service.pricingMode === 'par_unite' ? quantity : 1;
    const unit: Range = onQuote ? ZERO : { min: service.priceMin ?? 0, max: service.priceMax ?? 0 };
    const base = scale(unit, qty);

    let total = base;
    const displayed: EstimateLine['options'] = [];
    for (const option of service.options) {
      const { impact, display } = optionImpact(service, option, options[option.key], base, qty);
      if (!onQuote) total = add(total, impact);
      if (display) displayed.push({ key: option.key, label: option.label, value: display });
    }

    const tier =
      onQuote || service.pricingMode !== 'par_unite'
        ? undefined
        : [...rules.volumeDiscount]
            .sort((a, b) => b.minQuantity - a.minQuantity)
            .find((t) => qty >= t.minQuantity);
    const discountPercent = tier?.percent ?? 0;

    lines.push({
      serviceId: service.id,
      name: service.name,
      categorySlug: service.categorySlug,
      slug: service.slug,
      pricingMode: service.pricingMode,
      quantity: qty,
      unitLabel: service.unitLabel ?? '',
      onQuote,
      unit,
      options: displayed,
      total: roundRange(total),
      volumeDiscountPercent: discountPercent,
    });
    subtotal = add(subtotal, total);
    volumeDiscount = add(volumeDiscount, scale(total, discountPercent / 100));

    const d = service.estimatedDuration;
    if (
      !duration ||
      UNIT_RANK[d.unit] > UNIT_RANK[duration.unit] ||
      (d.unit === duration.unit && d.max > duration.max)
    ) {
      duration = { ...d };
    }
  }

  const level =
    rules.urgency.find((u) => u.key === input.urgency) ??
    (input.urgency === 'standard' ? { key: 'standard', label: 'Standard', percent: 0 } : null);
  if (!level) throw AppError.badRequest('Niveau d’urgence inconnu');
  const afterDiscount = {
    min: subtotal.min - volumeDiscount.min,
    max: subtotal.max - volumeDiscount.max,
  };
  const urgencyAmount = scale(afterDiscount, level.percent / 100);

  let travel: Estimate['travel'] = { status: 'none', fee: 0, commune: input.commune ?? null };
  if (input.mode === 'sur_site') {
    if (!input.commune) travel = { status: 'pending', fee: 0, commune: null };
    else {
      const zone = rules.travel.find((z) => z.commune === input.commune);
      travel = zone
        ? { status: 'included', fee: zone.fee, commune: input.commune }
        : { status: 'on_quote', fee: 0, commune: input.commune };
    }
  }

  const total = add(add(afterDiscount, urgencyAmount), { min: travel.fee, max: travel.fee });
  return {
    lines,
    subtotal: roundRange(subtotal),
    volumeDiscount: roundRange({ min: volumeDiscount.min, max: volumeDiscount.max }),
    urgency: {
      key: level.key,
      label: level.label,
      percent: level.percent,
      amount: roundRange(urgencyAmount),
    },
    travel,
    total: roundRange(total),
    hasOnQuoteItems: lines.some((l) => l.onQuote),
    isPlaceholderPrice: input.items.some((i) => i.service.isPlaceholderPrice),
    duration,
  };
}
