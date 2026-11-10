import type { estimateInputSchema } from '@kodav/shared';
import { type Estimate } from '@kodav/shared';
import { seedPricingRules } from '@kodav/shared/seed';
import { trusted } from 'mongoose';
import type { z } from 'zod';
import { AppError } from '../../lib/http.js';
import { Service, ServiceCategory } from '../catalog/catalog.model.js';
import { computeEstimate, type PricedService, type PricingRules } from './pricing.engine.js';
import { PricingRule } from './pricing.model.js';

export type EstimateParams = z.output<typeof estimateInputSchema>;

/** Règles actives en base ; valeurs du seed tant qu'elles n'existent pas. */
export async function loadPricingRules(): Promise<PricingRules> {
  const docs = await PricingRule.find({ isActive: true }).lean();
  const byType = new Map(docs.map((d) => [d.type, d]));
  return {
    urgency:
      byType.get('urgency')?.levels ?? (byType.has('urgency') ? [] : seedPricingRules.urgency),
    travel: byType.get('travel')?.zones ?? [],
    volumeDiscount: byType.get('volume_discount')?.tiers ?? [],
  };
}

/** Services actifs (pôle actif compris) demandés, avec ce qu'il faut au calcul. */
export async function loadPricedServices(ids: string[]): Promise<Map<string, PricedService>> {
  const services = await Service.find({ _id: trusted({ $in: ids }), isActive: true }).lean();
  const categories = await ServiceCategory.find(
    { _id: trusted({ $in: services.map((s) => s.category) }), isActive: true },
    { slug: 1 },
  ).lean();
  const categorySlugs = new Map(categories.map((c) => [String(c._id), c.slug]));
  const result = new Map<string, PricedService>();
  for (const s of services) {
    const categorySlug = categorySlugs.get(String(s.category));
    if (!categorySlug) continue;
    result.set(String(s._id), {
      id: String(s._id),
      name: s.name,
      slug: s.slug,
      categorySlug,
      pricingMode: s.pricingMode,
      unitLabel: s.unitLabel,
      priceMin: s.priceMin,
      priceMax: s.priceMax,
      isPlaceholderPrice: s.isPlaceholderPrice,
      options: s.options ?? [],
      estimatedDuration: s.estimatedDuration,
    });
  }
  return result;
}

export async function estimate(params: EstimateParams): Promise<Estimate> {
  const ids = [...new Set(params.items.map((i) => i.serviceId))];
  const [services, rules] = await Promise.all([loadPricedServices(ids), loadPricingRules()]);
  const items = params.items.map((item) => {
    const service = services.get(item.serviceId);
    if (!service) throw AppError.badRequest('Un des services choisis n’est plus disponible');
    return { service, quantity: item.quantity, options: item.options };
  });
  return computeEstimate({ ...params, items }, rules);
}
