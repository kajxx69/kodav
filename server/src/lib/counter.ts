import { formatReference } from '@kodav/shared';
import { Schema, model } from 'mongoose';

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = model('Counter', counterSchema);

/** Référence séquentielle par préfixe et par année (DEV-2026-0001), incrément atomique. */
export async function nextReference(prefix: 'DEV' | 'FAC' | 'TCK' | 'INT', date = new Date()) {
  const year = date.getUTCFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: `${prefix}-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  ).lean();
  return formatReference(prefix, year, counter!.seq);
}
