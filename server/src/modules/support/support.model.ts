import {
  ASSET_STATUSES,
  ASSET_TYPES,
  NOTIFICATION_TYPES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AssetStatus,
  type AssetType,
  type NotificationType,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@kodav/shared';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../lib/mongoose.js';

// --- Tickets ------------------------------------------------------------------

export interface TicketDoc {
  reference: string;
  client: Types.ObjectId;
  organization: Types.ObjectId | null;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  asset: Types.ObjectId | null;
  status: TicketStatus;
  statusHistory: { status: TicketStatus; at: Date; by: Types.ObjectId | null }[];
  assignee: Types.ObjectId | null;
  slaHours: number;
  slaDueAt: Date;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  satisfaction: { rating: number; comment: string; at: Date } | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<TicketDoc>(
  {
    reference: { type: String, required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    subject: { type: String, required: true },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    priority: { type: String, enum: TICKET_PRIORITIES, required: true },
    asset: { type: Schema.Types.ObjectId, ref: 'Asset', default: null },
    status: { type: String, enum: TICKET_STATUSES, default: 'ouvert' },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: TICKET_STATUSES },
        at: Date,
        by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    slaHours: { type: Number, required: true },
    slaDueAt: { type: Date, required: true },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    satisfaction: {
      type: new Schema({ rating: Number, comment: String, at: Date }, { _id: false }),
      default: null,
    },
    lastMessageAt: { type: Date, default: () => new Date() },
  },
  baseSchemaOptions,
);
ticketSchema.index({ organization: 1, status: 1 });
ticketSchema.index({ client: 1, status: 1 });
ticketSchema.index({ assignee: 1, status: 1 });
ticketSchema.index({ status: 1, priority: 1, slaDueAt: 1 });

export type TicketDocument = HydratedDocument<TicketDoc>;
export const Ticket = model<TicketDoc>('Ticket', ticketSchema);

export function pushTicketStatus(
  ticket: TicketDocument,
  status: TicketStatus,
  by: Types.ObjectId | null,
) {
  if (ticket.status === status) return false;
  ticket.status = status;
  ticket.statusHistory.push({ status, at: new Date(), by });
  if (status === 'resolu') ticket.resolvedAt = new Date();
  return true;
}

export interface TicketMessageDoc {
  ticket: Types.ObjectId;
  author: Types.ObjectId;
  body: string;
  attachments: { publicId: string; name: string; mime: string; size: number }[];
  isInternal: boolean;
  readBy: Types.ObjectId[];
  createdAt: Date;
}

const ticketMessageSchema = new Schema<TicketMessageDoc>(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    attachments: [{ _id: false, publicId: String, name: String, mime: String, size: Number }],
    isInternal: { type: Boolean, default: false },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  baseSchemaOptions,
);
export const TicketMessage = model<TicketMessageDoc>('TicketMessage', ticketMessageSchema);

// --- Parc informatique ---------------------------------------------------------

export interface AssetDoc {
  organization: Types.ObjectId | null;
  owner: Types.ObjectId | null;
  type: AssetType;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  location: string;
  assignedTo: string;
  purchaseDate: Date | null;
  warrantyUntil: Date | null;
  status: AssetStatus;
  notes: string;
  license: {
    product: string;
    seats: number;
    expiresAt: Date | null;
    keyLast5: string;
    keyEncrypted?: string;
  } | null;
  /** Seuils d'alerte déjà envoyés (jours avant expiration) pour la date en cours. */
  alertsSent: number[];
  createdAt: Date;
}

const assetSchema = new Schema<AssetDoc>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    owner: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: { type: String, enum: ASSET_TYPES, required: true },
    name: { type: String, required: true },
    brand: { type: String, default: '' },
    model: { type: String, default: '' },
    serialNumber: { type: String, default: '' },
    location: { type: String, default: '' },
    assignedTo: { type: String, default: '' },
    purchaseDate: { type: Date, default: null },
    warrantyUntil: { type: Date, default: null },
    status: { type: String, enum: ASSET_STATUSES, default: 'actif' },
    notes: { type: String, default: '' },
    license: {
      type: new Schema(
        {
          product: String,
          seats: Number,
          expiresAt: Date,
          keyLast5: { type: String, default: '' },
          // Clé complète chiffrée (AES-256-GCM), lisible par l'admin seulement.
          keyEncrypted: { type: String, select: false },
        },
        { _id: false },
      ),
      default: null,
    },
    alertsSent: { type: [Number], default: [] },
  },
  baseSchemaOptions,
);
assetSchema.index({ organization: 1, type: 1 });
assetSchema.index({ 'license.expiresAt': 1 });

export type AssetDocument = HydratedDocument<AssetDoc>;
export const Asset = model<AssetDoc>('Asset', assetSchema);

// --- Notifications et audit ------------------------------------------------------

export interface NotificationDoc {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  readAt: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  baseSchemaOptions,
);
notificationSchema.index({ user: 1, createdAt: -1 });
// Suppression automatique après 90 jours.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
export const Notification = model<NotificationDoc>('Notification', notificationSchema);

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    ip: String,
    userAgent: String,
    at: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ actor: 1, at: -1 });
export const AuditLog = model('AuditLog', auditLogSchema);
