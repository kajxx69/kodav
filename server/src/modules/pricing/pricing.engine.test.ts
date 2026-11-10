import { describe, expect, it } from 'vitest';
import { computeEstimate, type PricedService, type PricingRules } from './pricing.engine.js';

const rules: PricingRules = {
  urgency: [
    { key: 'standard', label: 'Standard', percent: 0 },
    { key: '24h', label: 'Sous 24 h', percent: 50 },
  ],
  travel: [{ commune: 'Cocody', fee: 5000 }],
  volumeDiscount: [
    { minQuantity: 10, percent: 5 },
    { minQuantity: 25, percent: 10 },
  ],
};

const base = {
  categorySlug: 'pole',
  isPlaceholderPrice: false,
  estimatedDuration: { min: 1, max: 2, unit: 'jour' as const },
};

const site: PricedService = {
  ...base,
  id: 'site',
  name: 'Site vitrine',
  slug: 'site-vitrine',
  pricingMode: 'forfait',
  priceMin: 250000,
  priceMax: 600000,
  estimatedDuration: { min: 1, max: 3, unit: 'semaine' },
  options: [
    {
      key: 'pages',
      label: 'Pages supplémentaires',
      type: 'number',
      min: 0,
      max: 20,
      perUnit: true,
      impact: { kind: 'fixed', min: 25000, max: 40000 },
    },
    {
      key: 'multilingue',
      label: 'Version anglaise',
      type: 'boolean',
      impact: { kind: 'percent', min: 20, max: 30 },
    },
  ],
};

const cabling: PricedService = {
  ...base,
  id: 'cablage',
  name: 'Câblage',
  slug: 'cablage',
  pricingMode: 'par_unite',
  unitLabel: 'poste',
  priceMin: 20000,
  priceMax: 35000,
  options: [
    {
      key: 'baie',
      label: 'Baie de brassage',
      type: 'boolean',
      impact: { kind: 'fixed', min: 150000, max: 350000 },
    },
  ],
};

const onQuote: PricedService = {
  ...base,
  id: 'app',
  name: 'Application',
  slug: 'application',
  pricingMode: 'sur_devis',
  options: [],
};

describe('computeEstimate', () => {
  it('applique les options d’un forfait (nombre et pourcentage)', () => {
    const e = computeEstimate(
      {
        items: [{ service: site, quantity: 1, options: { pages: 2, multilingue: true } }],
        urgency: 'standard',
        mode: 'distance',
      },
      rules,
    );
    // 250 000 + 2 × 25 000 + 20 % de 250 000 = 350 000 ; 600 000 + 80 000 + 180 000 = 860 000
    expect(e.lines[0]!.total).toEqual({ min: 350000, max: 860000 });
    expect(e.lines[0]!.options.map((o) => o.value)).toEqual(['2', 'Oui']);
    expect(e.travel.status).toBe('none');
    expect(e.total).toEqual({ min: 350000, max: 860000 });
    expect(e.duration).toEqual({ min: 1, max: 3, unit: 'semaine' });
  });

  it('applique remise volume, urgence et déplacement dans cet ordre', () => {
    const e = computeEstimate(
      {
        items: [{ service: cabling, quantity: 12, options: { baie: true } }],
        urgency: '24h',
        mode: 'sur_site',
        commune: 'Cocody',
      },
      rules,
    );
    // Ligne : 12 × 20 000 + 150 000 = 390 000 ; remise 5 % = 19 500 ; urgence 50 % de 370 500.
    expect(e.lines[0]!.total.min).toBe(390000);
    expect(e.lines[0]!.volumeDiscountPercent).toBe(5);
    expect(e.volumeDiscount.min).toBe(19500);
    expect(e.urgency.amount.min).toBe(185000);
    expect(e.travel).toEqual({ status: 'included', fee: 5000, commune: 'Cocody' });
    expect(e.total.min).toBe(Math.floor((370500 * 1.5 + 5000) / 500) * 500);
  });

  it('isole les services sur devis et signale le déplacement hors zone', () => {
    const e = computeEstimate(
      {
        items: [
          { service: onQuote, quantity: 1, options: {} },
          { service: site, quantity: 1, options: {} },
        ],
        urgency: 'standard',
        mode: 'sur_site',
        commune: 'Hors Abidjan',
      },
      rules,
    );
    expect(e.lines[0]!.onQuote).toBe(true);
    expect(e.hasOnQuoteItems).toBe(true);
    expect(e.total).toEqual({ min: 250000, max: 600000 });
    expect(e.travel.status).toBe('on_quote');
  });

  it('refuse une option inconnue, hors limites ou une urgence inconnue', () => {
    const run = (options: Record<string, unknown>, urgency = 'standard') =>
      computeEstimate(
        { items: [{ service: site, quantity: 1, options }], urgency, mode: 'distance' },
        rules,
      );
    expect(() => run({ inconnue: true })).toThrow(/option inconnue/);
    expect(() => run({ pages: 50 })).toThrow(/entre 0 et 20/);
    expect(() => run({ multilingue: 'oui' })).toThrow(/oui ou non/);
    expect(() => run({}, 'hier')).toThrow(/urgence inconnu/);
  });
});
