import { z } from 'zod';
import { CLIENT_PROFILES } from '../enums.js';

export const maintenancePlanSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  targetProfiles: z.array(z.enum(CLIENT_PROFILES)),
  basePriceMonthly: z.number(),
  pricePerSeatMonthly: z.number(),
  annualDiscountPercent: z.number(),
  minSeats: z.number(),
  maxSeats: z.number().nullable(),
  features: z.array(
    z.object({ key: z.string(), label: z.string(), value: z.union([z.boolean(), z.string()]) }),
  ),
  sla: z.object({
    basse: z.number(),
    normale: z.number(),
    haute: z.number(),
    critique: z.number(),
  }),
  includedVisitsPerMonth: z.number(),
  remoteSupport: z.boolean(),
  highlighted: z.boolean(),
  order: z.number(),
  isPlaceholderPrice: z.boolean(),
});
export type MaintenancePlan = z.infer<typeof maintenancePlanSchema>;

type PlanPricing = Pick<
  MaintenancePlan,
  'basePriceMonthly' | 'pricePerSeatMonthly' | 'annualDiscountPercent'
>;

/** Prix mensuel d'une formule pour un nombre de postes ; remise appliquée en facturation annuelle. */
export function planMonthlyPrice(plan: PlanPricing, seats: number, cycle: 'mensuel' | 'annuel') {
  const monthly = plan.basePriceMonthly + plan.pricePerSeatMonthly * seats;
  return cycle === 'annuel'
    ? Math.round(monthly * (1 - plan.annualDiscountPercent / 100))
    : monthly;
}

export function planCoversSeats(
  plan: Pick<MaintenancePlan, 'minSeats' | 'maxSeats'>,
  seats: number,
) {
  return seats >= plan.minSeats && (plan.maxSeats === null || seats <= plan.maxSeats);
}
