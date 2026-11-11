import { Schema, model, type Types } from 'mongoose';
import { ASSESSMENT_SEATS, CLIENT_PROFILES, type ClientProfile } from '@kodav/shared';
import { baseSchemaOptions } from '../../lib/mongoose.js';

export interface ItAssessmentDoc {
  profile: ClientProfile;
  seats: (typeof ASSESSMENT_SEATS)[number];
  answers: Record<string, string>;
  score: number;
  weakThemes: string[];
  lead: Types.ObjectId;
}

const itAssessmentSchema = new Schema<ItAssessmentDoc>(
  {
    profile: { type: String, enum: CLIENT_PROFILES, required: true },
    seats: { type: String, enum: ASSESSMENT_SEATS, required: true },
    answers: { type: Schema.Types.Mixed, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    weakThemes: { type: [String], default: [] },
    lead: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  },
  baseSchemaOptions,
);

export const ItAssessment = model<ItAssessmentDoc>('ItAssessment', itAssessmentSchema);
