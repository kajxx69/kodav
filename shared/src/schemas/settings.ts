import { z } from 'zod';

export const openingHoursSchema = z.object({ days: z.string(), hours: z.string() });

export const brandSchema = z.object({
  legalName: z.string().min(1),
  shortName: z.string().min(1),
  tagline: z.string(),
  phone: z.string(),
  whatsapp: z.string(),
  email: z.string(),
  serviceArea: z.string(),
  address: z.string(),
  openingHours: z.array(openingHoursSchema),
  social: z.object({
    facebook: z.string(),
    linkedin: z.string(),
    instagram: z.string(),
    tiktok: z.string(),
  }),
});
export type Brand = z.infer<typeof brandSchema>;

/** Chiffres clés : la section est masquée tant que la liste est vide. */
export const statSchema = z.object({ label: z.string(), value: z.number(), suffix: z.string() });
export type Stat = z.infer<typeof statSchema>;

export const publicSettingsSchema = z.object({
  brand: brandSchema,
  stats: z.array(statSchema),
});
export type PublicSettings = z.infer<typeof publicSettingsSchema>;
