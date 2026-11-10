import { Schema, model, type Types } from 'mongoose';
import {
  CLIENT_PROFILES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  type ClientProfile,
  type LeadSource,
  type LeadStatus,
} from '@kodav/shared';
import { baseSchemaOptions } from '../../lib/mongoose.js';

export interface LeadDoc {
  source: LeadSource;
  name: string;
  email: string;
  phone: string;
  company: string;
  profile?: ClientProfile;
  commune?: string;
  subject?: string;
  message: string;
  payload?: unknown;
  status: LeadStatus;
  assignee?: Types.ObjectId;
  consentAt: Date;
  ip?: string;
}

const leadSchema = new Schema<LeadDoc>(
  {
    source: { type: String, enum: LEAD_SOURCES, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, index: true },
    phone: { type: String, required: true },
    company: { type: String, default: '' },
    profile: { type: String, enum: CLIENT_PROFILES },
    commune: String,
    subject: String,
    message: { type: String, default: '' },
    payload: Schema.Types.Mixed,
    status: { type: String, enum: LEAD_STATUSES, default: 'nouveau' },
    assignee: { type: Schema.Types.ObjectId, ref: 'User' },
    consentAt: { type: Date, required: true },
    ip: String,
  },
  baseSchemaOptions,
);
leadSchema.index({ status: 1, createdAt: -1 });

export const Lead = model<LeadDoc>('Lead', leadSchema);
