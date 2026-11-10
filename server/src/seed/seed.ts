import {
  seedCategories,
  seedFaqs,
  seedPlans,
  seedPricingRules,
  seedServices,
} from '@kodav/shared/seed';
import { defaultBrand } from '../config/brand.js';
import { ServiceCategory, Service } from '../modules/catalog/catalog.model.js';
import { Faq } from '../modules/content/content.model.js';
import { Plan } from '../modules/plans/plans.model.js';
import { PricingRule } from '../modules/pricing/pricing.model.js';
import { SETTINGS_KEY, Settings } from '../modules/settings/settings.model.js';

/**
 * Données de démarrage idempotentes : `$setOnInsert` n'écrase jamais ce qui a été
 * modifié depuis l'admin, relancer le seed ne fait qu'ajouter ce qui manque.
 */
export async function seedDatabase() {
  const counts: Record<string, number> = {};
  const track = (key: string, upserted: number) => {
    counts[key] = (counts[key] ?? 0) + upserted;
  };

  const settings = await Settings.updateOne(
    { key: SETTINGS_KEY },
    { $setOnInsert: { key: SETTINGS_KEY, brand: defaultBrand, stats: [] } },
    { upsert: true },
  );
  track('settings', settings.upsertedCount);

  for (const [order, category] of seedCategories.entries()) {
    const res = await ServiceCategory.updateOne(
      { slug: category.slug },
      { $setOnInsert: { ...category, order: category.order ?? order } },
      { upsert: true },
    );
    track('categories', res.upsertedCount);
  }

  const categoryIds = new Map(
    (await ServiceCategory.find({}, { slug: 1 }).lean()).map((c) => [c.slug, c._id]),
  );
  for (const [order, { category, ...service }] of seedServices.entries()) {
    const categoryId = categoryIds.get(category);
    if (!categoryId) throw new Error(`Pôle inconnu dans le seed : ${category}`);
    const res = await Service.updateOne(
      { category: categoryId, slug: service.slug },
      {
        $setOnInsert: {
          ...service,
          category: categoryId,
          order,
          featured: service.featured ?? false,
          options: service.options ?? [],
          isPlaceholderPrice: service.pricingMode !== 'sur_devis',
        },
      },
      { upsert: true },
    );
    track('services', res.upsertedCount);
  }

  for (const plan of seedPlans) {
    const res = await Plan.updateOne(
      { slug: plan.slug },
      { $setOnInsert: { ...plan, isPlaceholderPrice: true } },
      { upsert: true },
    );
    track('plans', res.upsertedCount);
  }

  const rules = [
    { type: 'urgency', levels: seedPricingRules.urgency },
    {
      type: 'travel',
      zones: seedPricingRules.travel.map((z) => ({ ...z, isAbidjan: true })),
      outsideAbidjan: 'sur_devis',
    },
    { type: 'volume_discount', tiers: seedPricingRules.volumeDiscount },
  ] as const;
  for (const rule of rules) {
    const res = await PricingRule.updateOne(
      { type: rule.type },
      { $setOnInsert: { ...rule, isPlaceholder: true } },
      { upsert: true },
    );
    track('pricingRules', res.upsertedCount);
  }

  for (const [order, faq] of seedFaqs.entries()) {
    const res = await Faq.updateOne(
      { question: faq.question },
      { $setOnInsert: { ...faq, order } },
      { upsert: true },
    );
    track('faqs', res.upsertedCount);
  }

  return counts;
}
