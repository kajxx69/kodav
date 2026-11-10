import type { SchemaOptions } from 'mongoose';

/** Options communes : horodatage et sérialisation JSON sans _id/__v (→ id). */
export const baseSchemaOptions = {
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform(_doc: unknown, ret: Record<string, unknown>) {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
} satisfies SchemaOptions;

/** Paramètre de route utilisable comme slug (évite des requêtes inutiles sur des valeurs farfelues). */
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
