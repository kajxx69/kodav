import { z } from 'zod';
import { ABIDJAN_COMMUNES, CLIENT_PROFILES } from '../enums.js';
import { normalizeCiPhone } from '../format.js';

/** Téléphone ivoirien saisi librement, normalisé en +225XXXXXXXXXX. */
export const ciPhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const phone = normalizeCiPhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Numéro ivoirien attendu : 10 chiffres' });
      return z.NEVER;
    }
    return phone;
  });

export const contactInputSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom').max(120),
  email: z.email('Adresse email invalide').trim().toLowerCase().max(200),
  phone: ciPhoneSchema,
  company: z.string().trim().max(160).optional().default(''),
  profile: z.enum(CLIENT_PROFILES).optional(),
  commune: z.enum([...ABIDJAN_COMMUNES, 'Hors Abidjan']).optional(),
  subject: z.string().trim().min(3, 'Précisez le sujet').max(160),
  message: z.string().trim().min(10, 'Votre message est trop court').max(5000),
  consent: z.literal(true, { error: 'Votre accord est nécessaire pour être recontacté' }),
  /** Pot de miel : doit rester vide (champ invisible pour un humain). */
  website: z.string().max(500).optional().default(''),
});
export type ContactInput = z.input<typeof contactInputSchema>;
