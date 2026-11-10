import {
  APPOINTMENT_STATUSES,
  COMMUNE_CHOICES,
  INTERVENTION_MODES,
  type AppointmentStatus,
  type AvailabilitySettings as AvailabilitySettingsDto,
} from '@kodav/shared';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../lib/mongoose.js';

export const AVAILABILITY_KEY = 'global';

/** Valeurs d'exemple calées sur les horaires du site, modifiables dans l'admin. */
export const defaultAvailability: AvailabilitySettingsDto = {
  weekly: [
    { day: 0, open: false, ranges: [] },
    ...[1, 2, 3, 4, 5].map((day) => ({
      day,
      open: true,
      ranges: [
        { start: '08:00', end: '12:00' },
        { start: '13:00', end: '18:00' },
      ],
    })),
    { day: 6, open: true, ranges: [{ start: '09:00', end: '13:00' }] },
  ],
  slotDuration: 90,
  bufferMinutes: 30,
  capacityPerSlot: 1,
  technicianCount: 1,
  closedDates: [],
  minNoticeHours: 4,
  maxAdvanceDays: 30,
  cancelCutoffHours: 24,
};

const availabilitySchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: AVAILABILITY_KEY },
    weekly: [
      {
        _id: false,
        day: Number,
        open: Boolean,
        ranges: [{ _id: false, start: String, end: String }],
      },
    ],
    slotDuration: Number,
    bufferMinutes: Number,
    capacityPerSlot: Number,
    technicianCount: Number,
    closedDates: [{ _id: false, date: String, reason: String }],
    minNoticeHours: Number,
    maxAdvanceDays: Number,
    cancelCutoffHours: Number,
  },
  baseSchemaOptions,
);
export const AvailabilitySettings = model('AvailabilitySettings', availabilitySchema);

export interface AppointmentDoc {
  reference: string;
  client: Types.ObjectId | null;
  organization: Types.ObjectId | null;
  contact: { name: string; email: string; phone: string; profile?: string };
  quote: Types.ObjectId | null;
  service: Types.ObjectId | null;
  mode: (typeof INTERVENTION_MODES)[number];
  address: { street: string; commune: string | null; landmark: string };
  start: Date;
  end: Date;
  technician: Types.ObjectId | null;
  status: AppointmentStatus;
  statusHistory: { status: AppointmentStatus; at: Date; by: Types.ObjectId | null; note: string }[];
  description: string;
  internalNotes: string;
  reminderSentAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string;
  rescheduledFrom: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<AppointmentDoc>(
  {
    reference: { type: String, required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    contact: {
      name: String,
      email: { type: String, lowercase: true, index: true },
      phone: String,
      profile: String,
    },
    quote: { type: Schema.Types.ObjectId, ref: 'Quote', default: null },
    service: { type: Schema.Types.ObjectId, ref: 'Service', default: null },
    mode: { type: String, enum: INTERVENTION_MODES, required: true },
    address: {
      street: { type: String, default: '' },
      commune: { type: String, enum: [...COMMUNE_CHOICES, null], default: null },
      landmark: { type: String, default: '' },
    },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    technician: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: APPOINTMENT_STATUSES, required: true, default: 'demande_recue' },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: APPOINTMENT_STATUSES },
        at: Date,
        by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        note: { type: String, default: '' },
      },
    ],
    description: { type: String, default: '' },
    internalNotes: { type: String, default: '' },
    reminderSentAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    rescheduledFrom: { type: Date, default: null },
  },
  baseSchemaOptions,
);
appointmentSchema.index({ technician: 1, start: 1 });
appointmentSchema.index({ status: 1, start: 1 });

export type AppointmentDocument = HydratedDocument<AppointmentDoc>;
export const Appointment = model<AppointmentDoc>('Appointment', appointmentSchema);

export function pushAppointmentStatus(
  appointment: AppointmentDocument,
  status: AppointmentStatus,
  by: Types.ObjectId | null = null,
  note = '',
) {
  appointment.status = status;
  appointment.statusHistory.push({ status, at: new Date(), by, note });
}

export interface ReportDoc {
  appointment: Types.ObjectId;
  technician: Types.ObjectId;
  workDone: string;
  timeSpentMinutes: number;
  materials: { label: string; quantity: number }[];
  photos: { publicId: string; mime: string }[];
  clientComment: string;
  signature: { image: string; signerName: string; signedAt: Date } | null;
  status: 'brouillon' | 'signe';
}

const reportSchema = new Schema<ReportDoc>(
  {
    appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    technician: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workDone: { type: String, default: '' },
    timeSpentMinutes: { type: Number, default: 0 },
    materials: [{ _id: false, label: String, quantity: Number }],
    photos: [{ _id: false, publicId: String, mime: String }],
    clientComment: { type: String, default: '' },
    // Image PNG de la signature (data URL), jamais renvoyée dans les listes.
    signature: {
      type: new Schema(
        { image: { type: String, select: false }, signerName: String, signedAt: Date },
        { _id: false },
      ),
      default: null,
    },
    status: { type: String, enum: ['brouillon', 'signe'], default: 'brouillon' },
  },
  baseSchemaOptions,
);
export const InterventionReport = model<ReportDoc>('InterventionReport', reportSchema);
