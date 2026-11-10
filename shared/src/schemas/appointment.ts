import { z } from 'zod';
import { CLIENT_PROFILES, INTERVENTION_MODES } from '../enums.js';
import { paginationQuerySchema } from './auth.js';
import { ciPhoneSchema } from './contact.js';
import { communeSchema, objectIdSchema } from './quote.js';

export const APPOINTMENT_STATUSES = [
  'demande_recue',
  'planifiee',
  'en_route',
  'en_cours',
  'terminee',
  'validee',
  'annulee',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  demande_recue: 'Demande reçue',
  planifiee: 'Planifiée',
  en_route: 'Technicien en route',
  en_cours: 'En cours',
  terminee: 'Terminée',
  validee: 'Validée',
  annulee: 'Annulée',
};

/** Étapes de la timeline de suivi, dans l'ordre (hors annulation). */
export const APPOINTMENT_TIMELINE: AppointmentStatus[] = [
  'demande_recue',
  'planifiee',
  'en_route',
  'en_cours',
  'terminee',
  'validee',
];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure au format HH:MM');

export const availabilitySettingsSchema = z
  .object({
    weekly: z
      .array(
        z.object({
          day: z.number().int().min(0).max(6),
          open: z.boolean(),
          ranges: z.array(z.object({ start: time, end: time })).max(4),
        }),
      )
      .length(7),
    slotDuration: z.coerce.number().int().min(15).max(480),
    bufferMinutes: z.coerce.number().int().min(0).max(240),
    capacityPerSlot: z.coerce.number().int().min(1).max(50),
    technicianCount: z.coerce.number().int().min(1).max(50),
    closedDates: z
      .array(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ'),
          reason: z.string().trim().max(120).optional().default(''),
        }),
      )
      .max(100),
    minNoticeHours: z.coerce.number().int().min(0).max(168),
    maxAdvanceDays: z.coerce.number().int().min(1).max(365),
    cancelCutoffHours: z.coerce.number().int().min(0).max(168),
  })
  .superRefine((s, ctx) => {
    s.weekly.forEach((d, i) =>
      d.ranges.forEach((r, j) => {
        if (r.start >= r.end) {
          ctx.addIssue({
            code: 'custom',
            path: ['weekly', i, 'ranges', j, 'end'],
            message: 'La fin doit suivre le début',
          });
        }
      }),
    );
  });
export type AvailabilitySettings = z.output<typeof availabilitySettingsSchema>;
export type AvailabilitySettingsInput = z.input<typeof availabilitySettingsSchema>;

export const slotQuerySchema = z.object({
  from: z.iso.date().optional(),
  days: z.coerce.number().int().min(1).max(31).default(14),
});

export type Slot = { start: string; end: string; available: boolean };
export type SlotDay = { date: string; closed: boolean; slots: Slot[] };

export const appointmentAddressSchema = z.object({
  street: z.string().trim().max(200).optional().default(''),
  commune: communeSchema.optional(),
  landmark: z.string().trim().max(200).optional().default(''),
});

export const appointmentContactSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez votre nom').max(120),
  email: z.email('Adresse email invalide').trim().toLowerCase().max(200),
  phone: ciPhoneSchema,
  profile: z.enum(CLIENT_PROFILES).optional(),
});

export const bookAppointmentSchema = z
  .object({
    start: z.iso.datetime({ error: 'Choisissez un créneau' }),
    mode: z.enum(INTERVENTION_MODES),
    serviceId: objectIdSchema.optional(),
    quoteId: objectIdSchema.optional(),
    contact: appointmentContactSchema,
    address: appointmentAddressSchema.optional().default({ street: '', landmark: '' }),
    description: z.string().trim().min(5, 'Décrivez brièvement votre besoin').max(3000),
    consent: z.literal(true, { error: 'Votre accord est nécessaire pour traiter la demande' }),
    website: z.string().max(500).optional().default(''),
  })
  .refine((a) => a.mode !== 'sur_site' || Boolean(a.address.commune), {
    path: ['address', 'commune'],
    message: 'Indiquez la commune d’intervention',
    when: (p) => !p.issues.some((i) => ['mode', 'address'].includes(String(i.path?.[0]))),
  });
export type BookAppointmentInput = z.input<typeof bookAppointmentSchema>;

export const rescheduleSchema = z.object({
  start: z.iso.datetime({ error: 'Choisissez un créneau' }),
});
export const cancelSchema = z.object({ reason: z.string().trim().max(500).optional().default('') });

export const technicianStatusSchema = z.object({
  status: z.enum(['en_route', 'en_cours', 'terminee']),
});

export const reportDraftSchema = z.object({
  workDone: z.string().trim().max(5000).default(''),
  timeSpentMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .default(0),
  materials: z
    .array(
      z.object({
        label: z.string().trim().min(1, 'Libellé requis').max(160),
        quantity: z.coerce.number().int().min(1).max(10000),
      }),
    )
    .max(50)
    .default([]),
  clientComment: z.string().trim().max(2000).default(''),
});
export type ReportDraftInput = z.input<typeof reportDraftSchema>;

/** Signature tracée à l'écran : image PNG en data URL, 300 Ko au plus. */
export const signReportSchema = z.object({
  signerName: z.string().trim().min(2, 'Nom du signataire requis').max(120),
  signature: z
    .string()
    .max(400_000, 'Signature trop volumineuse')
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'Signature invalide'),
});

export const trackingLookupSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^INT-\d{4}-\d{4,}$/, 'Référence au format INT-AAAA-NNNN'),
  contact: z.string().trim().min(3, 'Téléphone ou email requis').max(200),
});
export type TrackingLookupInput = z.input<typeof trackingLookupSchema>;

export const adminAppointmentListSchema = paginationQuerySchema.extend({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const adminAppointmentUpdateSchema = z.object({
  technician: objectIdSchema.nullable().optional(),
  status: z.enum(['planifiee', 'annulee']).optional(),
  start: z.iso.datetime().optional(),
  internalNotes: z.string().trim().max(3000).optional(),
});

export type ReportDto = {
  workDone: string;
  timeSpentMinutes: number;
  materials: { label: string; quantity: number }[];
  clientComment: string;
  photos: { id: string }[];
  status: 'brouillon' | 'signe';
  signerName: string | null;
  signedAt: string | null;
};

export type AppointmentDto = {
  id: string;
  reference: string;
  status: AppointmentStatus;
  statusHistory: { status: AppointmentStatus; at: string; note: string }[];
  start: string;
  end: string;
  mode: (typeof INTERVENTION_MODES)[number];
  service: { id: string; name: string } | null;
  quote: { id: string; reference: string } | null;
  contact: { name: string; email: string; phone: string };
  address: { street: string; commune: string | null; landmark: string };
  description: string;
  technician: { id: string; firstName: string; lastName: string; phone: string } | null;
  hasAccount: boolean;
  canChange: boolean;
  cancelReason: string;
  report: ReportDto | null;
  createdAt: string;
};

export type AdminAppointmentDto = AppointmentDto & { internalNotes: string };

/** Vue publique du suivi : sans coordonnées personnelles. */
export type TrackingDto = {
  reference: string;
  status: AppointmentStatus;
  statusHistory: { status: AppointmentStatus; at: string }[];
  start: string;
  end: string;
  mode: (typeof INTERVENTION_MODES)[number];
  service: string | null;
  technicianFirstName: string | null;
  trackingToken: string;
};
