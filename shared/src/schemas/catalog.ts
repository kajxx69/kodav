import { z } from 'zod';
import { CLIENT_PROFILES, DURATION_UNITS, INTERVENTION_MODES, PRICING_MODES } from '../enums.js';

const impactSchema = z.object({
  kind: z.enum(['fixed', 'percent']),
  min: z.number(),
  max: z.number(),
});

export const serviceOptionSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['boolean', 'select', 'number']),
  choices: z
    .array(z.object({ value: z.string(), label: z.string(), impact: impactSchema.optional() }))
    .optional(),
  impact: impactSchema.optional(),
  perUnit: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  default: z.union([z.boolean(), z.string(), z.number()]).optional(),
});
export type ServiceOption = z.infer<typeof serviceOptionSchema>;

export const seoSchema = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()).optional(),
});

export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  icon: z.string(),
  order: z.number(),
  seo: seoSchema,
});
export type Category = z.infer<typeof categorySchema>;

export const serviceSchema = z.object({
  id: z.string(),
  category: z.object({ slug: z.string(), name: z.string() }),
  slug: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  longDescription: z.string(),
  targetProfiles: z.array(z.enum(CLIENT_PROFILES)),
  estimatedDuration: z.object({
    min: z.number(),
    max: z.number(),
    unit: z.enum(DURATION_UNITS),
  }),
  pricingMode: z.enum(PRICING_MODES),
  unitLabel: z.string().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  isPlaceholderPrice: z.boolean(),
  options: z.array(serviceOptionSchema),
  modes: z.array(z.enum(INTERVENTION_MODES)),
  featured: z.boolean(),
  order: z.number(),
  seo: seoSchema,
});
export type Service = z.infer<typeof serviceSchema>;

export const categoryWithServicesSchema = categorySchema.extend({
  services: z.array(serviceSchema),
});
export type CategoryWithServices = z.infer<typeof categoryWithServicesSchema>;

export const serviceListQuerySchema = z.object({
  profile: z.enum(CLIENT_PROFILES).optional(),
  category: z.string().max(80).optional(),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});
export type ServiceListQuery = z.input<typeof serviceListQuerySchema>;

/** Édition des tarifs d'un service depuis l'admin (les options arrivent avec le back-office complet). */
export const adminServiceUpdateSchema = z
  .object({
    pricingMode: z.enum(PRICING_MODES),
    unitLabel: z.string().trim().max(40).optional().default(''),
    priceMin: z.coerce.number().int('Montant entier en FCFA').min(0).max(1_000_000_000).optional(),
    priceMax: z.coerce.number().int('Montant entier en FCFA').min(0).max(1_000_000_000).optional(),
    isActive: z.boolean(),
    featured: z.boolean(),
  })
  .superRefine((s, ctx) => {
    if (s.pricingMode === 'sur_devis') return;
    if (s.priceMin === undefined) {
      ctx.addIssue({ code: 'custom', path: ['priceMin'], message: 'Prix minimum requis' });
    }
    if (s.priceMax === undefined) {
      ctx.addIssue({ code: 'custom', path: ['priceMax'], message: 'Prix maximum requis' });
    }
    if (s.priceMin !== undefined && s.priceMax !== undefined && s.priceMin > s.priceMax) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceMax'],
        message: 'Doit être supérieur au minimum',
      });
    }
    if (s.pricingMode === 'par_unite' && !s.unitLabel) {
      ctx.addIssue({
        code: 'custom',
        path: ['unitLabel'],
        message: 'Unité requise (poste, heure…)',
      });
    }
  });
export type AdminServiceUpdateInput = z.input<typeof adminServiceUpdateSchema>;

export type AdminService = Service & { isActive: boolean; categoryActive: boolean };
