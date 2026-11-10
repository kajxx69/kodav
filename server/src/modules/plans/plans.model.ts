import { Schema, model } from 'mongoose';
import { CLIENT_PROFILES, type MaintenancePlan } from '@kodav/shared';
import { baseSchemaOptions } from '../../lib/mongoose.js';

export type PlanDoc = Omit<MaintenancePlan, 'id'> & { isActive: boolean };

const planSchema = new Schema<PlanDoc>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    tagline: { type: String, default: '' },
    targetProfiles: { type: [String], enum: CLIENT_PROFILES },
    basePriceMonthly: { type: Number, min: 0, default: 0 },
    pricePerSeatMonthly: { type: Number, min: 0, default: 0 },
    annualDiscountPercent: { type: Number, min: 0, max: 100, default: 0 },
    minSeats: { type: Number, min: 1, default: 1 },
    maxSeats: { type: Number, default: null },
    features: [{ _id: false, key: String, label: String, value: Schema.Types.Mixed }],
    sla: { basse: Number, normale: Number, haute: Number, critique: Number },
    includedVisitsPerMonth: { type: Number, default: 0 },
    remoteSupport: { type: Boolean, default: true },
    highlighted: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isPlaceholderPrice: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

export const Plan = model<PlanDoc>('MaintenancePlan', planSchema);
