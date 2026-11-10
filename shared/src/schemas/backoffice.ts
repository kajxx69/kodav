import { z } from 'zod';
import {
  CLIENT_PROFILES,
  DURATION_UNITS,
  INTERVENTION_MODES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  PRICING_MODES,
  USER_ROLES,
  type LeadSource,
  type LeadStatus,
} from '../enums.js';
import { paginationQuerySchema } from './auth.js';
import { ciPhoneSchema } from './contact.js';
import { communeSchema, objectIdSchema } from './quote.js';

const text = (max: number) => z.string().trim().max(max).optional().default('');
const money = z.coerce.number().int('Montant entier en FCFA').min(0).max(1_000_000_000);

// --- Factures ----------------------------------------------------------------------

export const INVOICE_STATUSES = ['impayee', 'partielle', 'payee', 'annulee'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  impayee: 'À régler',
  partielle: 'Partiellement réglée',
  payee: 'Réglée',
  annulee: 'Annulée',
};

export const PAYMENT_METHODS = ['especes', 'virement', 'mobile_money', 'cheque'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  especes: 'Espèces',
  virement: 'Virement',
  mobile_money: 'Mobile Money',
  cheque: 'Chèque',
};

export const createInvoiceSchema = z.object({
  dueDays: z.coerce.number().int().min(0).max(180).default(15),
});

export const paymentInputSchema = z.object({
  amount: money.refine((v) => v > 0, 'Montant requis'),
  method: z.enum(PAYMENT_METHODS, { error: 'Choisissez un moyen de paiement' }),
  reference: text(80),
  paidAt: z.iso.date({ error: 'Date invalide' }),
});
export type PaymentInput = z.input<typeof paymentInputSchema>;

export const invoiceListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(INVOICE_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});

export type InvoiceDto = {
  id: string;
  reference: string;
  quote: { id: string; reference: string };
  billing: { name: string; company: string; email: string; phone: string; address: string };
  items: {
    label: string;
    description: string;
    quantity: number;
    unitLabel: string;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount: number;
  travelFee: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paid: number;
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
  overdue: boolean;
  payments: { amount: number; method: PaymentMethod; reference: string; paidAt: string }[];
  hasAccount: boolean;
};

// --- Abonnements (formule de maintenance souscrite) -----------------------------------

export const SUBSCRIPTION_STATUSES = ['active', 'suspendue', 'resiliee'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const subscriptionInputSchema = z.object({
  planId: objectIdSchema,
  seats: z.coerce.number().int().min(1).max(10000),
  billingCycle: z.enum(['mensuel', 'annuel']),
  startDate: z.iso.date({ error: 'Date invalide' }),
  endDate: z
    .union([z.iso.date(), z.literal(''), z.null()])
    .optional()
    .transform((v) => v || null),
  status: z.enum(SUBSCRIPTION_STATUSES).default('active'),
});
export type SubscriptionInput = z.input<typeof subscriptionInputSchema>;

export type SubscriptionDto = {
  id: string;
  plan: {
    id: string;
    name: string;
    sla: Record<'basse' | 'normale' | 'haute' | 'critique', number>;
  };
  seats: number;
  billingCycle: 'mensuel' | 'annuel';
  startDate: string;
  endDate: string | null;
  status: SubscriptionStatus;
  monthlyPrice: number;
};

// --- Prospects ----------------------------------------------------------------------

export const leadListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(LEAD_STATUSES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  q: z.string().trim().max(100).optional(),
});

export const leadUpdateSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  assignee: objectIdSchema.nullable().optional(),
  notes: z.string().trim().max(3000).optional(),
});

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  converti: 'Converti',
  perdu: 'Perdu',
};
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  contact: 'Formulaire de contact',
  diagnostic: 'Diagnostic express',
  bilan: 'Bilan informatique',
  devis_visiteur: 'Devis sans compte',
};

export type LeadDto = {
  id: string;
  source: LeadSource;
  status: LeadStatus;
  name: string;
  email: string;
  phone: string;
  company: string;
  profile: string | null;
  commune: string | null;
  subject: string;
  message: string;
  notes: string;
  assignee: { id: string; name: string } | null;
  quoteReference: string | null;
  createdAt: string;
};

// --- Clients (fiche 360°) -----------------------------------------------------------------

export const clientListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  type: z.enum(['organisation', 'particulier']).optional(),
});

export type ClientSummaryDto = {
  kind: 'organisation' | 'particulier';
  id: string;
  name: string;
  profile: string;
  email: string;
  phone: string;
  members: number;
  openTickets: number;
  quoteCount: number;
  invoicedTotal: number;
  dueTotal: number;
  subscription: string | null;
  createdAt: string;
};

export type Client360Dto = ClientSummaryDto & {
  address: { street: string; commune: string; city: string };
  taxId: string;
  rccm: string;
  notes: string;
  contacts: {
    id: string;
    name: string;
    email: string;
    phone: string;
    orgRole: string | null;
    isActive: boolean;
  }[];
  subscription360: SubscriptionDto | null;
  quotes: {
    id: string;
    reference: string;
    status: string;
    total: number | null;
    createdAt: string;
  }[];
  appointments: {
    id: string;
    reference: string;
    status: string;
    start: string;
    service: string | null;
  }[];
  tickets: {
    id: string;
    reference: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
  }[];
  assets: {
    id: string;
    name: string;
    type: string;
    status: string;
    licenseExpiresAt: string | null;
    keyStored: boolean;
  }[];
  invoices: {
    id: string;
    reference: string;
    status: InvoiceStatus;
    total: number;
    paid: number;
    issuedAt: string;
  }[];
};

export const clientNotesSchema = z.object({ notes: z.string().trim().max(5000) });

// --- Utilisateurs -----------------------------------------------------------------------

export const adminCreateUserSchema = z.object({
  firstName: z.string().trim().min(1, 'Prénom requis').max(80),
  lastName: z.string().trim().min(1, 'Nom requis').max(80),
  email: z.email('Adresse email invalide').trim().toLowerCase().max(200),
  phone: z
    .union([ciPhoneSchema, z.literal('')])
    .optional()
    .default(''),
  role: z.enum(['technicien', 'admin'], { error: 'Choisissez un rôle' }),
});
export type AdminCreateUserInput = z.input<typeof adminCreateUserSchema>;

export const adminUpdateUserSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});

// --- Contenu ------------------------------------------------------------------------------

export const testimonialSubmitSchema = z.object({
  content: z.string().trim().min(20, 'Quelques phrases, au moins 20 caractères').max(1000),
  rating: z.coerce.number().int().min(1).max(5),
  role: text(80),
  consent: z.literal(true, { error: 'Votre accord est nécessaire pour publier votre avis' }),
});
export type TestimonialSubmitInput = z.input<typeof testimonialSubmitSchema>;

export const adminTestimonialSchema = z.object({
  authorName: z.string().trim().min(2).max(120),
  role: text(80),
  company: text(120),
  profile: z.enum(CLIENT_PROFILES).optional(),
  content: z.string().trim().min(10).max(1000),
  rating: z.coerce.number().int().min(1).max(5),
  status: z.enum(['en_attente', 'publie', 'rejete']),
  order: z.coerce.number().int().default(0),
});

export type AdminTestimonialDto = z.output<typeof adminTestimonialSchema> & {
  id: string;
  fromClient: boolean;
  createdAt: string;
};

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Minuscules, chiffres et tirets uniquement')
  .max(80);

export const adminProjectSchema = z.object({
  slug,
  title: z.string().trim().min(2).max(160),
  category: text(80),
  client: text(120),
  summary: text(400),
  content: text(20000),
  images: z
    .array(z.object({ url: z.url('URL invalide'), alt: text(160) }))
    .max(12)
    .default([]),
  tags: z.array(z.string().trim().max(40)).max(12).default([]),
  status: z.enum(['brouillon', 'publie']),
});
export type AdminProjectInput = z.input<typeof adminProjectSchema>;

export const adminFaqSchema = z.object({
  question: z.string().trim().min(5).max(300),
  answer: z.string().trim().min(5).max(5000),
  category: text(60),
  order: z.coerce.number().int().default(0),
  isPublished: z.boolean().default(true),
});

// --- Catalogue complet ---------------------------------------------------------------------

export const adminCategorySchema = z.object({
  slug,
  name: z.string().trim().min(2).max(80),
  shortDescription: text(300),
  description: text(3000),
  icon: z.string().trim().max(40).default('package'),
  order: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  seo: z
    .object({ title: text(120), description: text(300) })
    .default({ title: '', description: '' }),
});
export type AdminCategoryInput = z.input<typeof adminCategorySchema>;

const impact = z.object({
  kind: z.enum(['fixed', 'percent']),
  min: z.coerce.number().min(0),
  max: z.coerce.number().min(0),
});

export const adminServiceOptionSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*$/, 'Clé : minuscules, chiffres, _')
    .max(40),
  label: z.string().trim().min(1).max(120),
  type: z.enum(['boolean', 'select', 'number']),
  choices: z
    .array(
      z.object({
        value: z.string().trim().min(1).max(60),
        label: z.string().trim().min(1).max(120),
        impact: impact.optional(),
      }),
    )
    .max(20)
    .optional(),
  impact: impact.optional(),
  perUnit: z.boolean().optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
});

export const adminServiceFullSchema = z
  .object({
    categoryId: objectIdSchema,
    slug,
    name: z.string().trim().min(2).max(120),
    shortDescription: text(300),
    longDescription: text(10000),
    targetProfiles: z.array(z.enum(CLIENT_PROFILES)).min(1, 'Au moins un profil'),
    estimatedDuration: z.object({
      min: z.coerce.number().min(0),
      max: z.coerce.number().min(0),
      unit: z.enum(DURATION_UNITS),
    }),
    pricingMode: z.enum(PRICING_MODES),
    unitLabel: text(40),
    priceMin: money.optional(),
    priceMax: money.optional(),
    options: z.array(adminServiceOptionSchema).max(15).default([]),
    modes: z.array(z.enum(INTERVENTION_MODES)).min(1, 'Au moins un mode'),
    featured: z.boolean().default(false),
    isActive: z.boolean().default(true),
    order: z.coerce.number().int().default(0),
    seo: z
      .object({
        title: text(120),
        description: text(300),
        keywords: z.array(z.string().max(60)).max(15).default([]),
      })
      .default({ title: '', description: '', keywords: [] }),
  })
  .superRefine((s, ctx) => {
    if (s.pricingMode !== 'sur_devis' && (s.priceMin === undefined || s.priceMax === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceMin'],
        message: 'Prix minimum et maximum requis',
      });
    }
    if (s.priceMin !== undefined && s.priceMax !== undefined && s.priceMin > s.priceMax) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceMax'],
        message: 'Doit être supérieur au minimum',
      });
    }
    if (s.estimatedDuration.min > s.estimatedDuration.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['estimatedDuration', 'max'],
        message: 'Durée maximale trop courte',
      });
    }
    const keys = new Set<string>();
    s.options.forEach((o, i) => {
      if (keys.has(o.key))
        ctx.addIssue({ code: 'custom', path: ['options', i, 'key'], message: 'Clé déjà utilisée' });
      keys.add(o.key);
      if (o.type === 'select' && !o.choices?.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['options', i, 'choices'],
          message: 'Ajoutez au moins un choix',
        });
      }
    });
  });
export type AdminServiceFullInput = z.input<typeof adminServiceFullSchema>;

export const pricingRulesInputSchema = z.object({
  urgency: z
    .array(
      z.object({
        key: z
          .string()
          .trim()
          .regex(/^[a-z0-9]+$/i)
          .max(20),
        label: z.string().trim().min(1).max(60),
        percent: z.coerce.number().min(0).max(300),
      }),
    )
    .min(1)
    .max(6)
    .refine((l) => l.some((u) => u.key === 'standard'), 'Le niveau « standard » est obligatoire'),
  travel: z.array(z.object({ commune: communeSchema, fee: money })).max(30),
  volumeDiscount: z
    .array(
      z.object({
        minQuantity: z.coerce.number().int().min(2),
        percent: z.coerce.number().min(0).max(90),
      }),
    )
    .max(10),
});
export type PricingRulesInput = z.input<typeof pricingRulesInputSchema>;

export const adminPlanSchema = z.object({
  name: z.string().trim().min(2).max(60),
  tagline: text(200),
  targetProfiles: z.array(z.enum(CLIENT_PROFILES)).min(1),
  basePriceMonthly: money,
  pricePerSeatMonthly: money,
  annualDiscountPercent: z.coerce.number().min(0).max(90),
  minSeats: z.coerce.number().int().min(1),
  maxSeats: z
    .union([z.coerce.number().int().min(1), z.null()])
    .optional()
    .default(null),
  features: z
    .array(
      z.object({
        key: z.string().trim().max(40),
        label: z.string().trim().min(1).max(160),
        value: z.union([z.boolean(), z.string().max(80)]),
      }),
    )
    .max(30),
  sla: z.object({
    basse: z.coerce.number().int().min(1),
    normale: z.coerce.number().int().min(1),
    haute: z.coerce.number().int().min(1),
    critique: z.coerce.number().int().min(1),
  }),
  includedVisitsPerMonth: z.coerce.number().int().min(0),
  remoteSupport: z.boolean(),
  highlighted: z.boolean(),
  isActive: z.boolean(),
  order: z.coerce.number().int().default(0),
});
export type AdminPlanInput = z.input<typeof adminPlanSchema>;

// --- Paramètres ---------------------------------------------------------------------------

export const EMAIL_TEMPLATE_KEYS = [
  'quote_received',
  'quote_sent',
  'appointment_confirmed',
  'appointment_reminder',
  'ticket_reply',
  'invoice_issued',
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export const EMAIL_TEMPLATES: Record<EmailTemplateKey, { label: string; variables: string[] }> = {
  quote_received: {
    label: 'Demande de devis reçue',
    variables: ['prenom', 'reference', 'estimation'],
  },
  quote_sent: { label: 'Devis envoyé', variables: ['prenom', 'reference', 'montant', 'validite'] },
  appointment_confirmed: {
    label: 'Rendez-vous enregistré',
    variables: ['prenom', 'reference', 'date', 'mode'],
  },
  appointment_reminder: {
    label: 'Rappel de rendez-vous',
    variables: ['prenom', 'reference', 'date', 'mode'],
  },
  ticket_reply: {
    label: 'Réponse à un ticket',
    variables: ['prenom', 'reference', 'sujet', 'auteur', 'message'],
  },
  invoice_issued: {
    label: 'Facture émise',
    variables: ['prenom', 'reference', 'montant', 'echeance'],
  },
};

const hours = z.object({
  days: z.string().trim().min(1).max(60),
  hours: z.string().trim().min(1).max(60),
});

export const adminSettingsSchema = z.object({
  brand: z.object({
    legalName: z.string().trim().min(2).max(120),
    shortName: z.string().trim().min(2).max(40),
    tagline: text(200),
    phone: z.string().trim().max(20),
    whatsapp: z.string().trim().max(20),
    email: z.email('Adresse email invalide'),
    serviceArea: text(200),
    address: text(200),
    openingHours: z.array(hours).max(7),
    social: z.object({
      facebook: z.union([z.url(), z.literal('')]).default(''),
      linkedin: z.union([z.url(), z.literal('')]).default(''),
      instagram: z.union([z.url(), z.literal('')]).default(''),
      tiktok: z.union([z.url(), z.literal('')]).default(''),
    }),
  }),
  stats: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        value: z.coerce.number().min(0),
        suffix: text(10),
      }),
    )
    .max(6),
  quote: z.object({ validityDays: z.coerce.number().int().min(1).max(365) }),
  invoice: z.object({
    taxRate: z.coerce.number().min(0).max(50),
    legalMentions: text(2000),
    bankDetails: text(1000),
  }),
  emailTemplates: z
    .array(z.object({ key: z.enum(EMAIL_TEMPLATE_KEYS), subject: text(200), body: text(4000) }))
    .max(EMAIL_TEMPLATE_KEYS.length),
});
export type AdminSettingsInput = z.input<typeof adminSettingsSchema>;
export type AdminSettingsDto = z.output<typeof adminSettingsSchema>;

// --- Tableau de bord et audit ---------------------------------------------------------------

export const dashboardQuerySchema = z.object({
  period: z.enum(['30', '90', '365']).default('30'),
});

export type DashboardDto = {
  period: number;
  kpis: {
    pendingQuotes: number;
    appointmentsToday: number;
    openTickets: Record<'basse' | 'normale' | 'haute' | 'critique', number>;
    newLeads: number;
    invoiced: number;
    collected: number;
    outstanding: number;
    acceptanceRate: number | null;
  };
  series: { date: string; quotes: number; accepted: number; invoiced: number; tickets: number }[];
};

export const auditListQuerySchema = paginationQuerySchema.extend({
  entity: z.string().trim().max(40).optional(),
});

export type AuditLogDto = {
  id: string;
  actor: { id: string; name: string } | null;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  ip: string;
  at: string;
};

export const EXPORT_ENTITIES = [
  'devis',
  'factures',
  'prospects',
  'clients',
  'tickets',
  'interventions',
] as const;
export type ExportEntity = (typeof EXPORT_ENTITIES)[number];
