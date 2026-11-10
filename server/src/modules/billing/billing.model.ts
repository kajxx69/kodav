import {
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  SUBSCRIPTION_STATUSES,
  type InvoiceStatus,
  type PaymentMethod,
  type SubscriptionStatus,
} from '@kodav/shared';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../lib/mongoose.js';

export interface InvoiceDoc {
  reference: string;
  quote: Types.ObjectId;
  client: Types.ObjectId | null;
  organization: Types.ObjectId | null;
  /** Coordonnées figées à l'émission : une modification ultérieure du client n'altère pas la facture. */
  billingSnapshot: { name: string; company: string; email: string; phone: string; address: string };
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
  issuedAt: Date;
  dueAt: Date;
  paymentStatus: InvoiceStatus;
  payments: {
    amount: number;
    method: PaymentMethod;
    reference: string;
    paidAt: Date;
    recordedBy: Types.ObjectId;
  }[];
  createdAt: Date;
}

const invoiceSchema = new Schema<InvoiceDoc>(
  {
    reference: { type: String, required: true, unique: true },
    quote: { type: Schema.Types.ObjectId, ref: 'Quote', required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    billingSnapshot: {
      name: String,
      company: String,
      email: String,
      phone: String,
      address: String,
    },
    items: [
      {
        _id: false,
        label: String,
        description: String,
        quantity: Number,
        unitLabel: String,
        unitPrice: Number,
        total: Number,
      },
    ],
    subtotal: Number,
    discount: Number,
    travelFee: Number,
    taxRate: Number,
    taxAmount: Number,
    total: Number,
    issuedAt: { type: Date, required: true, index: true },
    dueAt: { type: Date, required: true },
    paymentStatus: { type: String, enum: INVOICE_STATUSES, default: 'impayee', index: true },
    payments: [
      {
        _id: false,
        amount: Number,
        method: { type: String, enum: PAYMENT_METHODS },
        reference: String,
        paidAt: Date,
        recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  baseSchemaOptions,
);

export type InvoiceDocument = HydratedDocument<InvoiceDoc>;
export const Invoice = model<InvoiceDoc>('Invoice', invoiceSchema);

export interface SubscriptionDoc {
  organization: Types.ObjectId | null;
  client: Types.ObjectId | null;
  plan: Types.ObjectId;
  seats: number;
  billingCycle: 'mensuel' | 'annuel';
  startDate: Date;
  endDate: Date | null;
  status: SubscriptionStatus;
  /** Prix mensuel figé à la souscription (FCFA). */
  priceSnapshot: number;
  createdAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDoc>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    plan: { type: Schema.Types.ObjectId, ref: 'MaintenancePlan', required: true },
    seats: { type: Number, required: true },
    billingCycle: { type: String, enum: ['mensuel', 'annuel'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: 'active' },
    priceSnapshot: { type: Number, required: true },
  },
  baseSchemaOptions,
);
export const Subscription = model<SubscriptionDoc>('Subscription', subscriptionSchema);
