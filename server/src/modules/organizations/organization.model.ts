import { CLIENT_PROFILES } from '@kodav/shared';
import { Schema, model } from 'mongoose';
import { baseSchemaOptions } from '../../lib/mongoose.js';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Un particulier n'a pas d'organisation : seuls les profils « structure » sont admis.
    type: {
      type: String,
      enum: CLIENT_PROFILES.filter((p) => p !== 'particulier'),
      required: true,
    },
    taxId: { type: String, default: '' },
    rccm: { type: String, default: '' },
    address: {
      street: { type: String, default: '' },
      commune: { type: String, default: '' },
      city: { type: String, default: 'Abidjan' },
    },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    activeSubscription: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    /** Notes internes de l'équipe, jamais renvoyées au client. */
    notes: { type: String, default: '', select: false },
  },
  baseSchemaOptions,
);
organizationSchema.index({ name: 'text' });

export const Organization = model('Organization', organizationSchema);
