import { Schema, model } from 'mongoose';
import { baseSchemaOptions } from '../../lib/mongoose.js';

/** Un document par type de règle ; le moteur de calcul arrive en phase 3. */
export interface PricingRuleDoc {
  type: 'urgency' | 'travel' | 'volume_discount';
  isActive: boolean;
  levels?: { key: string; label: string; percent: number }[];
  zones?: { commune: string; fee: number; isAbidjan: boolean }[];
  outsideAbidjan?: 'sur_devis';
  tiers?: { minQuantity: number; percent: number }[];
  isPlaceholder: boolean;
}

const pricingRuleSchema = new Schema<PricingRuleDoc>(
  {
    type: {
      type: String,
      enum: ['urgency', 'travel', 'volume_discount'],
      required: true,
      unique: true,
    },
    isActive: { type: Boolean, default: true },
    levels: [{ _id: false, key: String, label: String, percent: Number }],
    zones: [{ _id: false, commune: String, fee: Number, isAbidjan: Boolean }],
    outsideAbidjan: { type: String, enum: ['sur_devis'] },
    tiers: [{ _id: false, minQuantity: Number, percent: Number }],
    isPlaceholder: { type: Boolean, default: false },
  },
  baseSchemaOptions,
);

export const PricingRule = model<PricingRuleDoc>('PricingRule', pricingRuleSchema);
