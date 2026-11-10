import { z } from 'zod';
import type { DURATION_UNITS, PRICING_MODES } from '../enums.js';
import { ABIDJAN_COMMUNES, CLIENT_PROFILES, INTERVENTION_MODES, QUOTE_STATUSES } from '../enums.js';
import { paginationQuerySchema } from './auth.js';
import { ciPhoneSchema } from './contact.js';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Identifiant invalide');

export const COMMUNE_CHOICES = [...ABIDJAN_COMMUNES, 'Hors Abidjan'] as const;
export const communeSchema = z.enum(COMMUNE_CHOICES, { error: 'Choisissez une commune' });

export const optionValueSchema = z.union([z.boolean(), z.string().max(80), z.number()]);

export const quoteItemInputSchema = z.object({
  serviceId: objectIdSchema,
  quantity: z.coerce.number().int().min(1, 'Au moins 1').max(1000, '1 000 maximum').default(1),
  options: z.record(z.string().max(40), optionValueSchema).default({}),
});
export type QuoteItemInput = z.input<typeof quoteItemInputSchema>;

/** Paramètres du calcul : identiques pour l'estimation en direct et la soumission. */
export const estimateInputSchema = z.object({
  items: z
    .array(quoteItemInputSchema)
    .min(1, 'Choisissez au moins un service')
    .max(15, '15 services maximum par demande'),
  urgency: z.string().trim().max(20).default('standard'),
  mode: z.enum(INTERVENTION_MODES).default('sur_site'),
  commune: communeSchema.optional(),
});
export type EstimateInput = z.input<typeof estimateInputSchema>;

export type Range = { min: number; max: number };

export type EstimateLine = {
  serviceId: string;
  name: string;
  categorySlug: string;
  slug: string;
  pricingMode: (typeof PRICING_MODES)[number];
  quantity: number;
  unitLabel: string;
  /** Service « sur devis » : pas de prix calculé, exclu des totaux. */
  onQuote: boolean;
  unit: Range;
  options: { key: string; label: string; value: string }[];
  /** Total de la ligne avant remise volume. */
  total: Range;
  volumeDiscountPercent: number;
};

export type Estimate = {
  lines: EstimateLine[];
  subtotal: Range;
  volumeDiscount: Range;
  urgency: { key: string; label: string; percent: number; amount: Range };
  /** included : frais connus ; pending : commune à préciser ; on_quote : hors Abidjan ; none : pas de déplacement. */
  travel: {
    status: 'included' | 'pending' | 'on_quote' | 'none';
    fee: number;
    commune: string | null;
  };
  total: Range;
  hasOnQuoteItems: boolean;
  isPlaceholderPrice: boolean;
  duration: { min: number; max: number; unit: (typeof DURATION_UNITS)[number] } | null;
};

export const quoteContactSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom').max(120),
  email: z.email('Adresse email invalide').trim().toLowerCase().max(200),
  phone: ciPhoneSchema,
  profile: z.enum(CLIENT_PROFILES, { error: 'Choisissez votre profil' }),
  company: z.string().trim().max(160).optional().default(''),
});
export type QuoteContact = z.output<typeof quoteContactSchema>;

export const quoteSubmitInputSchema = estimateInputSchema
  .extend({
    contact: quoteContactSchema,
    address: z.string().trim().max(300).optional().default(''),
    clientNotes: z.string().trim().max(3000).optional().default(''),
    source: z.enum(['configurateur', 'diagnostic']).default('configurateur'),
    consent: z.literal(true, { error: 'Votre accord est nécessaire pour traiter la demande' }),
    website: z.string().max(500).optional().default(''),
  })
  .refine((input) => input.mode !== 'sur_site' || Boolean(input.commune), {
    path: ['commune'],
    message: 'Indiquez la commune d’intervention',
    when: (payload) =>
      !payload.issues.some((i) => ['mode', 'commune'].includes(String(i.path?.[0]))),
  });
export type QuoteSubmitInput = z.input<typeof quoteSubmitInputSchema>;

/** Brouillon du configurateur : tout est facultatif, il est validé à la soumission. */
export const quoteDraftSchema = z.object({
  step: z.number().int().min(0).max(10).default(0),
  items: z.array(quoteItemInputSchema).max(15).default([]),
  urgency: z.string().max(20).default('standard'),
  mode: z.enum(INTERVENTION_MODES).default('sur_site'),
  commune: communeSchema.optional(),
  address: z.string().max(300).default(''),
  clientNotes: z.string().max(3000).default(''),
  source: z.enum(['configurateur', 'diagnostic']).default('configurateur'),
});
export type QuoteDraft = z.output<typeof quoteDraftSchema>;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type QuoteFinalItem = {
  label: string;
  description: string;
  quantity: number;
  unitLabel: string;
  unitPrice: number;
  total: number;
};

export type QuoteDto = {
  id: string;
  reference: string;
  status: QuoteStatus;
  statusHistory: { status: QuoteStatus; at: string; note: string }[];
  contact: QuoteContact;
  organization: { id: string; name: string } | null;
  hasAccount: boolean;
  urgency: string;
  mode: (typeof INTERVENTION_MODES)[number];
  commune: string | null;
  address: string;
  clientNotes: string;
  source: 'configurateur' | 'diagnostic' | 'admin';
  estimate: Estimate;
  finalItems: QuoteFinalItem[];
  finalTotals: { subtotal: number; discount: number; travelFee: number; total: number } | null;
  validUntil: string | null;
  decidedAt: string | null;
  decisionReason: string;
  createdAt: string;
  submittedAt: string;
};

export type AdminQuoteDto = QuoteDto & { adminNotes: string };

export const quoteListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(QUOTE_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});

export const quoteDecisionInputSchema = z.object({
  decision: z.enum(['accept', 'decline']),
  reason: z.string().trim().max(1000).optional().default(''),
});
export type QuoteDecisionInput = z.input<typeof quoteDecisionInputSchema>;

export const quoteFinalItemInputSchema = z.object({
  label: z.string().trim().min(1, 'Libellé requis').max(200),
  description: z.string().trim().max(500).optional().default(''),
  quantity: z.coerce.number().int().min(1).max(10000),
  unitLabel: z.string().trim().max(40).optional().default(''),
  unitPrice: z.coerce.number().int('Montant entier en FCFA').min(0).max(1_000_000_000),
});
export type QuoteFinalItemInput = z.input<typeof quoteFinalItemInputSchema>;

export const adminQuoteUpdateSchema = z.object({
  finalItems: z.array(quoteFinalItemInputSchema).max(50),
  discount: z.coerce.number().int().min(0).default(0),
  travelFee: z.coerce.number().int().min(0).default(0),
  adminNotes: z.string().trim().max(5000).optional().default(''),
});
export type AdminQuoteUpdateInput = z.input<typeof adminQuoteUpdateSchema>;

export const adminQuoteSendSchema = z.object({
  validityDays: z.coerce.number().int().min(1).max(365).optional(),
  message: z.string().trim().max(2000).optional().default(''),
});
export type AdminQuoteSendInput = z.input<typeof adminQuoteSendSchema>;
