import {
  CLIENT_PROFILES,
  INTERVENTION_MODES,
  QUOTE_STATUSES,
  type AdminQuoteDto,
  type Estimate,
  type QuoteDraft,
  type QuoteDto,
  type QuoteStatus,
} from '@kodav/shared';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../lib/mongoose.js';

export interface QuoteDoc {
  reference?: string;
  client: Types.ObjectId | null;
  organization: Types.ObjectId | null;
  contact: { name: string; email: string; phone: string; profile: string; company: string };
  /** Saisie d'origine (services, quantités, options) : permet de recalculer l'estimation. */
  request: { serviceId: string; quantity: number; options: Record<string, unknown> }[];
  urgency: string;
  mode: (typeof INTERVENTION_MODES)[number];
  commune: string | null;
  address: string;
  clientNotes: string;
  adminNotes: string;
  /** Instantané de l'estimation au moment de la demande (prix figés). */
  estimate: Estimate | null;
  finalItems: {
    label: string;
    description: string;
    quantity: number;
    unitLabel: string;
    unitPrice: number;
    total: number;
  }[];
  finalTotals: { subtotal: number; discount: number; travelFee: number; total: number } | null;
  status: QuoteStatus;
  statusHistory: { status: QuoteStatus; at: Date; by: Types.ObjectId | null; note: string }[];
  validUntil: Date | null;
  submittedAt: Date | null;
  sentAt: Date | null;
  decidedAt: Date | null;
  decisionReason: string;
  source: 'configurateur' | 'diagnostic' | 'admin';
  lead: Types.ObjectId | null;
  /** Brouillon du configurateur d'un client connecté. */
  draft: QuoteDraft | null;
  createdAt: Date;
  updatedAt: Date;
}

const quoteSchema = new Schema<QuoteDoc>(
  {
    reference: { type: String, unique: true, sparse: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    contact: {
      name: String,
      email: { type: String, lowercase: true, index: true },
      phone: String,
      profile: { type: String, enum: [...CLIENT_PROFILES, ''] },
      company: { type: String, default: '' },
    },
    request: [{ _id: false, serviceId: String, quantity: Number, options: Schema.Types.Mixed }],
    urgency: { type: String, default: 'standard' },
    mode: { type: String, enum: INTERVENTION_MODES, default: 'sur_site' },
    commune: { type: String, default: null },
    address: { type: String, default: '' },
    clientNotes: { type: String, default: '' },
    adminNotes: { type: String, default: '' },
    estimate: { type: Schema.Types.Mixed, default: null },
    finalItems: [
      {
        _id: false,
        label: String,
        description: { type: String, default: '' },
        quantity: Number,
        unitLabel: { type: String, default: '' },
        unitPrice: Number,
        total: Number,
      },
    ],
    finalTotals: {
      type: new Schema(
        { subtotal: Number, discount: Number, travelFee: Number, total: Number },
        { _id: false },
      ),
      default: null,
    },
    status: { type: String, enum: QUOTE_STATUSES, required: true, default: 'soumis' },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: QUOTE_STATUSES },
        at: Date,
        by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        note: { type: String, default: '' },
      },
    ],
    validUntil: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    decidedAt: { type: Date, default: null },
    decisionReason: { type: String, default: '' },
    source: {
      type: String,
      enum: ['configurateur', 'diagnostic', 'admin'],
      default: 'configurateur',
    },
    lead: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    draft: { type: Schema.Types.Mixed, default: null },
  },
  baseSchemaOptions,
);
quoteSchema.index({ client: 1, createdAt: -1 });
quoteSchema.index({ status: 1, createdAt: -1 });
// Un seul brouillon par client.
quoteSchema.index(
  { client: 1 },
  { unique: true, partialFilterExpression: { status: 'brouillon' }, name: 'one_draft_per_client' },
);

export type QuoteDocument = HydratedDocument<QuoteDoc>;
export const Quote = model<QuoteDoc>('Quote', quoteSchema);

export function pushStatus(
  quote: QuoteDocument,
  status: QuoteStatus,
  by: Types.ObjectId | null = null,
  note = '',
) {
  quote.status = status;
  quote.statusHistory.push({ status, at: new Date(), by, note });
}

type OrgRef = { _id: Types.ObjectId; name: string } | Types.ObjectId | null;

export function toQuoteDto(quote: QuoteDoc & { _id: Types.ObjectId }): QuoteDto {
  const org = quote.organization as OrgRef;
  return {
    id: String(quote._id),
    reference: quote.reference ?? '',
    status: quote.status,
    statusHistory: quote.statusHistory.map((h) => ({
      status: h.status,
      at: h.at.toISOString(),
      note: h.note,
    })),
    contact: {
      name: quote.contact.name,
      email: quote.contact.email,
      phone: quote.contact.phone,
      profile: quote.contact.profile as QuoteDto['contact']['profile'],
      company: quote.contact.company,
    },
    organization: org && 'name' in org ? { id: String(org._id), name: org.name } : null,
    hasAccount: Boolean(quote.client),
    urgency: quote.urgency,
    mode: quote.mode,
    commune: quote.commune,
    address: quote.address,
    clientNotes: quote.clientNotes,
    source: quote.source,
    estimate: quote.estimate!,
    finalItems: quote.finalItems.map(
      ({ label, description, quantity, unitLabel, unitPrice, total }) => ({
        label,
        description,
        quantity,
        unitLabel,
        unitPrice,
        total,
      }),
    ),
    finalTotals: quote.finalTotals
      ? {
          subtotal: quote.finalTotals.subtotal,
          discount: quote.finalTotals.discount,
          travelFee: quote.finalTotals.travelFee,
          total: quote.finalTotals.total,
        }
      : null,
    validUntil: quote.validUntil?.toISOString() ?? null,
    decidedAt: quote.decidedAt?.toISOString() ?? null,
    decisionReason: quote.decisionReason,
    createdAt: quote.createdAt.toISOString(),
    submittedAt: (quote.submittedAt ?? quote.createdAt).toISOString(),
  };
}

export function toAdminQuoteDto(quote: QuoteDoc & { _id: Types.ObjectId }): AdminQuoteDto {
  return { ...toQuoteDto(quote), adminNotes: quote.adminNotes };
}
