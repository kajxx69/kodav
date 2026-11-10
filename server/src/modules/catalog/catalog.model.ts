import { Schema, model, type Types } from 'mongoose';
import {
  CLIENT_PROFILES,
  DURATION_UNITS,
  INTERVENTION_MODES,
  PRICING_MODES,
  type ClientProfile,
  type DurationUnit,
  type InterventionMode,
  type PricingMode,
  type ServiceOption,
} from '@kodav/shared';
import { baseSchemaOptions } from '../../lib/mongoose.js';

const seoSchema = new Schema(
  { title: String, description: String, keywords: [String] },
  { _id: false },
);

export interface CategoryDoc {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  icon: string;
  order: number;
  isActive: boolean;
  seo: { title: string; description: string };
}

const categorySchema = new Schema<CategoryDoc>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    shortDescription: { type: String, default: '' },
    description: { type: String, default: '' },
    icon: { type: String, default: 'layers' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    seo: seoSchema,
  },
  baseSchemaOptions,
);

export const ServiceCategory = model<CategoryDoc>('ServiceCategory', categorySchema);

export interface ServiceDoc {
  category: Types.ObjectId;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  targetProfiles: ClientProfile[];
  estimatedDuration: { min: number; max: number; unit: DurationUnit };
  pricingMode: PricingMode;
  unitLabel?: string;
  priceMin?: number;
  priceMax?: number;
  isPlaceholderPrice: boolean;
  options: ServiceOption[];
  modes: InterventionMode[];
  featured: boolean;
  order: number;
  isActive: boolean;
  image?: { url: string; publicId: string; alt: string };
  seo: { title: string; description: string; keywords: string[] };
}

const impactSchema = new Schema(
  { kind: { type: String, enum: ['fixed', 'percent'] }, min: Number, max: Number },
  { _id: false },
);

const optionSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['boolean', 'select', 'number'], required: true },
    choices: [{ _id: false, value: String, label: String, impact: impactSchema }],
    impact: impactSchema,
    perUnit: Boolean,
    min: Number,
    max: Number,
    default: Schema.Types.Mixed,
  },
  { _id: false },
);

const serviceSchema = new Schema<ServiceDoc>(
  {
    category: { type: Schema.Types.ObjectId, ref: 'ServiceCategory', required: true, index: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    shortDescription: { type: String, default: '' },
    longDescription: { type: String, default: '' },
    targetProfiles: { type: [String], enum: CLIENT_PROFILES, index: true },
    estimatedDuration: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 1 },
      unit: { type: String, enum: DURATION_UNITS, default: 'heure' },
    },
    pricingMode: { type: String, enum: PRICING_MODES, required: true },
    unitLabel: String,
    priceMin: { type: Number, min: 0 },
    priceMax: { type: Number, min: 0 },
    isPlaceholderPrice: { type: Boolean, default: false },
    options: [optionSchema],
    modes: { type: [String], enum: INTERVENTION_MODES },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    image: { url: String, publicId: String, alt: String },
    seo: seoSchema,
  },
  baseSchemaOptions,
);
serviceSchema.index({ category: 1, slug: 1 }, { unique: true });
serviceSchema.index({ isActive: 1, featured: 1, order: 1 });

export const Service = model<ServiceDoc>('Service', serviceSchema);
