import { z } from 'zod';
import { TICKET_PRIORITIES, type TicketPriority } from '../enums.js';
import { paginationQuerySchema } from './auth.js';
import { objectIdSchema } from './quote.js';

// --- Tickets ------------------------------------------------------------------

export const TICKET_CATEGORIES = [
  'materiel',
  'logiciel',
  'reseau',
  'acces_comptes',
  'site_web',
  'autre',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  materiel: 'Matériel',
  logiciel: 'Logiciel',
  reseau: 'Réseau',
  acces_comptes: 'Accès et comptes',
  site_web: 'Site web',
  autre: 'Autre',
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  critique: 'Critique',
};

export const TICKET_STATUSES = ['ouvert', 'en_cours', 'attente_client', 'resolu', 'ferme'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  attente_client: 'En attente de votre réponse',
  resolu: 'Résolu',
  ferme: 'Fermé',
};

/**
 * Délais cibles (heures ouvrées) sans contrat de maintenance : valeurs d'exemple,
 * les formules souscrites ont leurs propres délais.
 */
export const DEFAULT_SLA_HOURS: Record<TicketPriority, number> = {
  basse: 120,
  normale: 72,
  haute: 48,
  critique: 24,
};

export const MAX_ATTACHMENTS = 3;

const messageBody = z
  .string()
  .trim()
  .min(1, 'Écrivez votre message')
  .max(5000, '5 000 caractères maximum');

export const createTicketSchema = z.object({
  subject: z.string().trim().min(4, 'Précisez le sujet').max(160),
  category: z.enum(TICKET_CATEGORIES, { error: 'Choisissez une catégorie' }),
  priority: z.enum(TICKET_PRIORITIES).default('normale'),
  assetId: objectIdSchema.optional(),
  body: messageBody,
});
export type CreateTicketInput = z.input<typeof createTicketSchema>;

export const ticketMessageSchema = z.object({
  body: messageBody,
  isInternal: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

export const rateTicketSchema = z.object({
  rating: z.coerce.number().int().min(1, 'Choisissez une note').max(5),
  comment: z.string().trim().max(1000).optional().default(''),
});
export type RateTicketInput = z.input<typeof rateTicketSchema>;

export const ticketListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(TICKET_STATUSES).optional(),
  open: z.enum(['true', 'false']).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignee: z.union([objectIdSchema, z.literal('me'), z.literal('none')]).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const adminTicketUpdateSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignee: objectIdSchema.nullable().optional(),
});

export type TicketAttachmentDto = { id: string; name: string; mime: string; size: number };

export type TicketMessageDto = {
  id: string;
  author: { id: string; name: string; role: 'client' | 'technicien' | 'admin' };
  body: string;
  isInternal: boolean;
  attachments: TicketAttachmentDto[];
  createdAt: string;
};

export type TicketDto = {
  id: string;
  reference: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  statusHistory: { status: TicketStatus; at: string }[];
  client: { id: string; name: string; email: string; organization: string | null } | null;
  asset: { id: string; name: string; type: AssetType } | null;
  assignee: { id: string; name: string } | null;
  slaDueAt: string;
  slaHours: number;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  satisfaction: { rating: number; comment: string; at: string } | null;
  lastMessageAt: string;
  unread: number;
  createdAt: string;
};

export type TicketDetailDto = TicketDto & { messages: TicketMessageDto[] };

// --- Parc informatique ----------------------------------------------------------

export const ASSET_TYPES = [
  'poste',
  'portable',
  'serveur',
  'imprimante',
  'reseau',
  'licence',
  'autre',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  poste: 'Poste fixe',
  portable: 'Ordinateur portable',
  serveur: 'Serveur',
  imprimante: 'Imprimante',
  reseau: 'Équipement réseau',
  licence: 'Licence logicielle',
  autre: 'Autre',
};

export const ASSET_STATUSES = ['actif', 'en_panne', 'retire'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  actif: 'En service',
  en_panne: 'En panne',
  retire: 'Retiré',
};

// Champ date vide : « '' » côté formulaire, « null » une fois transformé (renvoi du front).
const optionalDate = z
  .union([z.iso.date({ error: 'Date invalide' }), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v ? v : null));
const text = (max: number) => z.string().trim().max(max).optional().default('');

export const assetInputSchema = z
  .object({
    type: z.enum(ASSET_TYPES, { error: 'Choisissez un type' }),
    name: z.string().trim().min(2, 'Nommez l’équipement').max(120),
    brand: text(80),
    model: text(80),
    serialNumber: text(80),
    location: text(120),
    assignedTo: text(120),
    purchaseDate: optionalDate,
    warrantyUntil: optionalDate,
    status: z.enum(ASSET_STATUSES).default('actif'),
    notes: text(2000),
    license: z
      .object({
        product: text(120),
        seats: z.coerce.number().int().min(1).max(100000).default(1),
        expiresAt: optionalDate,
        /** Clé saisie : seuls ses 5 derniers caractères sont gardés, sauf dépôt chiffré. */
        key: z.string().trim().max(200).optional().default(''),
        storeKey: z.boolean().optional().default(false),
      })
      .optional(),
  })
  .superRefine((a, ctx) => {
    if (a.type !== 'licence') return;
    if (!a.license?.product) {
      ctx.addIssue({
        code: 'custom',
        path: ['license', 'product'],
        message: 'Indiquez le logiciel',
      });
    }
    if (!a.license?.expiresAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['license', 'expiresAt'],
        message: 'Indiquez la date d’expiration',
      });
    }
    if (a.license?.storeKey && !a.license.key) {
      ctx.addIssue({
        code: 'custom',
        path: ['license', 'key'],
        message: 'Saisissez la clé à confier',
      });
    }
  });
export type AssetInput = z.input<typeof assetInputSchema>;

export type AssetDto = {
  id: string;
  type: AssetType;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  location: string;
  assignedTo: string;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  status: AssetStatus;
  notes: string;
  license: {
    product: string;
    seats: number;
    expiresAt: string | null;
    keyLast5: string;
    keyStored: boolean;
  } | null;
  openTickets: number;
  createdAt: string;
};

export const LICENSE_ALERT_DAYS = [30, 7, 0] as const;

// --- Notifications ---------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  'ticket_message',
  'ticket_status',
  'ticket_new',
  'appointment_status',
  'quote_sent',
  'license_expiring',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationDto = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationList = { items: NotificationDto[]; unread: number };
