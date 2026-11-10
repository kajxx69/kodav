import { Schema, model } from 'mongoose';
import type { Brand, Stat } from '@kodav/shared';
import { baseSchemaOptions } from '../../lib/mongoose.js';

export const SETTINGS_KEY = 'global';

export interface SettingsDoc {
  key: string;
  brand: Brand;
  stats: Stat[];
  quote: { validityDays: number };
  invoice: { taxRate: number; legalMentions: string; bankDetails: string };
  features: { turnstile: boolean };
  emailTemplates: { key: string; subject: string; body: string }[];
}

const settingsSchema = new Schema<SettingsDoc>(
  {
    // Document unique : la clé garantit qu'il n'en existe qu'un.
    key: { type: String, required: true, unique: true, default: SETTINGS_KEY },
    brand: {
      legalName: { type: String, required: true },
      shortName: { type: String, required: true },
      tagline: String,
      phone: String,
      whatsapp: String,
      email: String,
      serviceArea: String,
      address: String,
      openingHours: [{ _id: false, days: String, hours: String }],
      social: { facebook: String, linkedin: String, instagram: String, tiktok: String },
    },
    stats: [{ _id: false, label: String, value: Number, suffix: { type: String, default: '' } }],
    quote: { validityDays: { type: Number, default: 30 } },
    invoice: {
      taxRate: { type: Number, default: 0 },
      legalMentions: { type: String, default: '' },
      bankDetails: { type: String, default: '' },
    },
    features: { turnstile: { type: Boolean, default: false } },
    emailTemplates: [{ _id: false, key: String, subject: String, body: String }],
  },
  baseSchemaOptions,
);

export const Settings = model<SettingsDoc>('Settings', settingsSchema);
