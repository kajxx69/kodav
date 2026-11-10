import type { bookAppointmentSchema } from '@kodav/shared';
import {
  APPOINTMENT_STATUS_LABELS,
  INTERVENTION_MODE_LABELS,
  availabilitySettingsSchema,
  type AppointmentDto,
  type AppointmentStatus,
  type AvailabilitySettings as AvailabilityDto,
  type ReportDto,
  type UserRole,
} from '@kodav/shared';
import { trusted, type QueryFilter, type Types } from 'mongoose';
import type { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { nextReference } from '../../lib/counter.js';
import { AppError } from '../../lib/http.js';
import { sendTemplatedMail } from '../../lib/mailer.js';
import { emitTo } from '../../lib/socket.js';
import type { RequestUser } from '../../middlewares/auth.js';
import { Service } from '../catalog/catalog.model.js';
import { Quote } from '../quotes/quote.model.js';
import {
  AVAILABILITY_KEY,
  Appointment,
  AvailabilitySettings,
  InterventionReport,
  defaultAvailability,
  pushAppointmentStatus,
  type AppointmentDoc,
  type AppointmentDocument,
  type ReportDoc,
} from './appointment.model.js';
import { computeSlots, findSlot, isoDate } from './availability.engine.js';

/** Statuts qui occupent un créneau. */
const ACTIVE: AppointmentStatus[] = ['demande_recue', 'planifiee', 'en_route', 'en_cours'];

export async function getAvailability(): Promise<AvailabilityDto> {
  const doc = await AvailabilitySettings.findOne({ key: AVAILABILITY_KEY }).lean();
  if (!doc) return defaultAvailability;
  const parsed = availabilitySettingsSchema.safeParse(doc);
  return parsed.success ? parsed.data : defaultAvailability;
}

export async function listSlots(from: string, days: number, ignoreId?: Types.ObjectId) {
  const settings = await getAvailability();
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(start.getTime() + days * 24 * 3600_000);
  const busy = await Appointment.find(
    {
      status: trusted({ $in: ACTIVE }),
      start: trusted({ $lt: end }),
      end: trusted({ $gt: start }),
      ...(ignoreId ? { _id: trusted({ $ne: ignoreId }) } : {}),
    },
    { start: 1, end: 1 },
  ).lean();
  return computeSlots(settings, busy, { from, days });
}

/** Vérifie que le créneau est proposé et encore libre (avant enregistrement). */
async function assertSlotFree(start: string, ignoreId?: Types.ObjectId) {
  const settings = await getAvailability();
  const date = isoDate(new Date(start));
  const days = await listSlots(date, 1, ignoreId);
  const slot = findSlot(days, start);
  if (!slot)
    throw AppError.badRequest('Ce créneau n’est pas proposé', [
      { path: 'start', message: 'Créneau indisponible' },
    ]);
  if (!slot.available) {
    throw AppError.conflict('Ce créneau vient d’être réservé, choisissez-en un autre', [
      { path: 'start', message: 'Créneau complet' },
    ]);
  }
  return { slot, settings };
}

// --- Conversion ------------------------------------------------------------------

type Populated = AppointmentDoc & {
  _id: Types.ObjectId;
  service: { _id: Types.ObjectId; name: string } | Types.ObjectId | null;
  quote: { _id: Types.ObjectId; reference: string } | Types.ObjectId | null;
  technician:
    | { _id: Types.ObjectId; firstName: string; lastName: string; phone: string }
    | Types.ObjectId
    | null;
};

const populated = <T extends object>(v: unknown, key: string): T | null =>
  v && typeof v === 'object' && key in v ? (v as T) : null;

function reportDto(report: (ReportDoc & { _id: Types.ObjectId }) | null): ReportDto | null {
  if (!report) return null;
  return {
    workDone: report.workDone,
    timeSpentMinutes: report.timeSpentMinutes,
    materials: report.materials.map(({ label, quantity }) => ({ label, quantity })),
    clientComment: report.clientComment,
    photos: report.photos.map((p) => ({ id: p.publicId.split('/')[1]! })),
    status: report.status,
    signerName: report.signature?.signerName ?? null,
    signedAt: report.signature?.signedAt?.toISOString() ?? null,
  };
}

export async function cancelCutoff() {
  return (await getAvailability()).cancelCutoffHours;
}

export function toAppointmentDto(
  a: Populated,
  report: (ReportDoc & { _id: Types.ObjectId }) | null,
  cutoffHours: number,
): AppointmentDto {
  const service = populated<{ _id: Types.ObjectId; name: string }>(a.service, 'name');
  const quote = populated<{ _id: Types.ObjectId; reference: string }>(a.quote, 'reference');
  const tech = populated<{
    _id: Types.ObjectId;
    firstName: string;
    lastName: string;
    phone: string;
  }>(a.technician, 'firstName');
  return {
    id: String(a._id),
    reference: a.reference,
    status: a.status,
    statusHistory: a.statusHistory.map((h) => ({
      status: h.status,
      at: h.at.toISOString(),
      note: h.note,
    })),
    start: a.start.toISOString(),
    end: a.end.toISOString(),
    mode: a.mode,
    service: service ? { id: String(service._id), name: service.name } : null,
    quote: quote ? { id: String(quote._id), reference: quote.reference } : null,
    contact: { name: a.contact.name, email: a.contact.email, phone: a.contact.phone },
    address: {
      street: a.address?.street ?? '',
      commune: a.address?.commune ?? null,
      landmark: a.address?.landmark ?? '',
    },
    description: a.description,
    technician: tech
      ? {
          id: String(tech._id),
          firstName: tech.firstName,
          lastName: tech.lastName,
          phone: tech.phone,
        }
      : null,
    hasAccount: Boolean(a.client),
    canChange:
      ['demande_recue', 'planifiee'].includes(a.status) &&
      a.start.getTime() - Date.now() > cutoffHours * 3600_000,
    cancelReason: a.cancelReason,
    report: reportDto(report),
    createdAt: a.createdAt.toISOString(),
  };
}

const POPULATE = [
  { path: 'service', select: 'name' },
  { path: 'quote', select: 'reference' },
  { path: 'technician', select: 'firstName lastName phone' },
];

export async function loadAppointmentDto(id: Types.ObjectId | string) {
  const [a, report, cutoff] = await Promise.all([
    Appointment.findById(id).populate(POPULATE).lean<Populated>(),
    InterventionReport.findOne({ appointment: id }).lean(),
    cancelCutoff(),
  ]);
  if (!a) throw AppError.notFound('Intervention introuvable');
  return toAppointmentDto(a, report, cutoff);
}

export async function loadAppointmentDtos(
  filter: QueryFilter<AppointmentDoc>,
  sort: Record<string, 1 | -1> = { start: 1 },
  limit = 100,
) {
  const [items, cutoff] = await Promise.all([
    Appointment.find(filter).sort(sort).limit(limit).populate(POPULATE).lean<Populated[]>(),
    cancelCutoff(),
  ]);
  const reports = await InterventionReport.find({
    appointment: trusted({ $in: items.map((i) => i._id) }),
  }).lean();
  const byAppointment = new Map(reports.map((r) => [String(r.appointment), r]));
  return items.map((a) => toAppointmentDto(a, byAppointment.get(String(a._id)) ?? null, cutoff));
}

// --- Notifications ------------------------------------------------------------------

const when = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Abidjan',
  }).format(d);

function inBackground(task: Promise<unknown>, what: string) {
  task.catch((err: unknown) => logger.error({ err }, what));
}

/** Diffusion temps réel : client, équipe et page de suivi publique (prénom du technicien seul). */
function broadcast(a: AppointmentDocument | (AppointmentDoc & { _id: Types.ObjectId })) {
  const rooms = [`appointment:${String(a._id)}`, 'staff'];
  if (a.client) rooms.push(`user:${String(a.client)}`);
  if (a.technician) rooms.push(`user:${String(a.technician)}`);
  inBackground(
    (async () => {
      const { User } = await import('../users/user.model.js');
      const tech = a.technician ? await User.findById(a.technician, { firstName: 1 }).lean() : null;
      emitTo(rooms, 'appointment:status', {
        id: String(a._id),
        reference: a.reference,
        status: a.status,
        at: new Date().toISOString(),
        technicianFirstName: tech?.firstName ?? null,
      });
    })(),
    'Diffusion temps réel',
  );
}

function trackingUrl(a: Pick<AppointmentDoc, 'reference' | 'client'> & { _id: Types.ObjectId }) {
  return a.client
    ? `${env.CLIENT_URL}/espace-client/rendez-vous/${String(a._id)}`
    : `${env.CLIENT_URL}/suivi?reference=${a.reference}`;
}

const STATUS_MESSAGES: Partial<Record<AppointmentStatus, string>> = {
  planifiee: 'Votre intervention est planifiée.',
  en_route: 'Notre technicien est en route.',
  terminee: 'L’intervention est terminée.',
  validee: 'Le rapport d’intervention a été signé ; il est disponible dans votre espace.',
  annulee: 'Votre intervention a été annulée.',
};

export function notifyStatus(a: AppointmentDocument) {
  broadcast(a);
  if (a.client) {
    inBackground(
      import('../notifications/notification.service.js').then(({ notify }) =>
        notify([a.client], {
          type: 'appointment_status',
          title: `Intervention ${a.reference} : ${APPOINTMENT_STATUS_LABELS[a.status].toLowerCase()}`,
          body: when(a.start),
          link: `/espace-client/rendez-vous/${String(a._id)}`,
        }),
      ),
      'Notification de rendez-vous',
    );
  }
  const message = STATUS_MESSAGES[a.status];
  if (!message) return;
  inBackground(
    sendTemplatedMail({
      to: a.contact.email,
      subject: `Intervention ${a.reference} : ${APPOINTMENT_STATUS_LABELS[a.status].toLowerCase()}`,
      greeting: `Bonjour ${a.contact.name.split(' ')[0]},`,
      paragraphs: [message, `Rendez-vous : ${when(a.start)}.`],
      action: { label: 'Suivre l’intervention', url: trackingUrl(a) },
    }),
    'Email de changement de statut',
  );
}

// --- Réservation ------------------------------------------------------------------

type BookInput = z.output<typeof bookAppointmentSchema>;

export async function bookAppointment(input: BookInput, user: RequestUser | null) {
  const { slot, settings } = await assertSlotFree(input.start);
  const asClient = user?.role === 'client' ? user : null;

  let quote = null;
  if (input.quoteId) {
    quote = await Quote.findOne({
      _id: input.quoteId,
      status: 'accepte',
      ...(asClient ? {} : { 'contact.email': input.contact.email }),
    }).lean();
    if (
      asClient &&
      quote &&
      String(quote.client) !== asClient.id &&
      String(quote.organization) !== String(asClient.organization)
    )
      quote = null;
  }
  const service = input.serviceId
    ? await Service.findOne({ _id: input.serviceId, isActive: true }, { _id: 1 }).lean()
    : null;

  const appointment = new Appointment({
    reference: await nextReference('INT'),
    client: asClient?._id ?? null,
    organization: asClient?.organization ?? null,
    contact: input.contact,
    quote: quote?._id ?? null,
    service: service?._id ?? null,
    mode: input.mode,
    address: {
      street: input.address.street,
      commune: input.mode === 'sur_site' ? (input.address.commune ?? null) : null,
      landmark: input.address.landmark,
    },
    start: new Date(slot.start),
    end: new Date(slot.end),
    description: input.description,
    statusHistory: [],
  });
  pushAppointmentStatus(appointment, 'demande_recue', asClient?._id ?? null);
  await appointment.save();

  // Deux réservations simultanées : la seconde est annulée si la capacité est dépassée.
  const overlapping = await Appointment.countDocuments({
    status: trusted({ $in: ACTIVE }),
    start: trusted({ $lt: appointment.end }),
    end: trusted({ $gt: appointment.start }),
  });
  if (overlapping > Math.min(settings.capacityPerSlot, settings.technicianCount)) {
    await Appointment.deleteOne({ _id: appointment._id });
    throw AppError.conflict('Ce créneau vient d’être réservé, choisissez-en un autre', [
      { path: 'start', message: 'Créneau complet' },
    ]);
  }

  broadcast(appointment);
  inBackground(
    Promise.all([
      sendTemplatedMail({
        to: appointment.contact.email,
        subject: `Rendez-vous ${appointment.reference} enregistré`,
        greeting: `Bonjour ${appointment.contact.name.split(' ')[0]},`,
        paragraphs: [
          `Votre demande d’intervention ${INTERVENTION_MODE_LABELS[appointment.mode].toLowerCase()} est enregistrée pour le ${when(appointment.start)}.`,
          'Nous vous confirmons le technicien affecté très vite. Vous recevrez un rappel la veille.',
          `Pour suivre l’intervention : référence ${appointment.reference} et votre téléphone ou email.`,
        ],
        action: { label: 'Suivre l’intervention', url: trackingUrl(appointment) },
      }),
      notifyTeam(appointment),
    ]),
    'Emails de réservation',
  );
  return loadAppointmentDto(appointment._id);
}

async function notifyTeam(a: AppointmentDocument) {
  const { getPublicSettings } = await import('../settings/settings.service.js');
  const { brand } = await getPublicSettings();
  if (!brand.email) return;
  await sendTemplatedMail({
    to: brand.email,
    subject: `Nouveau rendez-vous ${a.reference}`,
    greeting: 'Bonjour,',
    paragraphs: [
      `${a.contact.name} a réservé le ${when(a.start)} (${INTERVENTION_MODE_LABELS[a.mode].toLowerCase()}${a.address.commune ? `, ${a.address.commune}` : ''}).`,
      `Besoin : ${a.description}`,
      'Affectez un technicien depuis le planning.',
    ],
    action: { label: 'Ouvrir le planning', url: `${env.CLIENT_URL}/admin/planning` },
  });
}

// --- Accès ------------------------------------------------------------------

export function clientFilter(user: RequestUser): QueryFilter<AppointmentDoc> {
  const or: QueryFilter<AppointmentDoc>[] = [{ client: user._id }];
  if (user.organization) or.push({ organization: user.organization });
  return { $or: or };
}

export async function findOwnedAppointment(id: unknown, user: RequestUser) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))
    throw AppError.notFound('Intervention introuvable');
  const filter =
    user.role === 'admin'
      ? { _id: id }
      : user.role === 'technicien'
        ? { _id: id, technician: user._id }
        : { _id: id, ...clientFilter(user) };
  const a = await Appointment.findOne(filter);
  if (!a) throw AppError.notFound('Intervention introuvable');
  return a;
}

/** Droit d'écoute en temps réel d'une intervention (Socket.io). */
export async function canJoinAppointment(userId: string, role: UserRole, id: string) {
  if (role === 'admin') return true;
  const a = await Appointment.findById(id, { client: 1, organization: 1, technician: 1 }).lean();
  if (!a) return false;
  if (role === 'technicien') return String(a.technician) === userId;
  if (String(a.client) === userId) return true;
  if (!a.organization) return false;
  const { User } = await import('../users/user.model.js');
  const u = await User.findById(userId, { organization: 1 }).lean();
  return Boolean(u?.organization) && String(u!.organization) === String(a.organization);
}

function assertChangeable(a: AppointmentDocument, cutoffHours: number) {
  if (!['demande_recue', 'planifiee'].includes(a.status)) {
    throw AppError.conflict('Cette intervention ne peut plus être modifiée');
  }
  if (a.start.getTime() - Date.now() <= cutoffHours * 3600_000) {
    throw AppError.conflict(
      `Modification possible jusqu’à ${cutoffHours} h avant l’intervention. Contactez-nous directement.`,
    );
  }
}

export async function rescheduleAppointment(
  a: AppointmentDocument,
  start: string,
  by: Types.ObjectId,
) {
  assertChangeable(a, await cancelCutoff());
  const { slot } = await assertSlotFree(start, a._id);
  a.rescheduledFrom = a.start;
  a.start = new Date(slot.start);
  a.end = new Date(slot.end);
  a.reminderSentAt = null;
  a.statusHistory.push({
    status: a.status,
    at: new Date(),
    by,
    note: `Reporté au ${when(a.start)}`,
  });
  await a.save();
  broadcast(a);
  inBackground(
    sendTemplatedMail({
      to: a.contact.email,
      subject: `Intervention ${a.reference} reportée`,
      greeting: `Bonjour ${a.contact.name.split(' ')[0]},`,
      paragraphs: [`Votre intervention est désormais prévue le ${when(a.start)}.`],
      action: { label: 'Suivre l’intervention', url: trackingUrl(a) },
    }),
    'Email de report',
  );
  return loadAppointmentDto(a._id);
}

export async function cancelAppointment(
  a: AppointmentDocument,
  reason: string,
  by: Types.ObjectId,
  force = false,
) {
  if (!force) assertChangeable(a, await cancelCutoff());
  else if (['terminee', 'validee', 'annulee'].includes(a.status)) {
    throw AppError.conflict('Cette intervention ne peut plus être annulée');
  }
  a.cancelledAt = new Date();
  a.cancelReason = reason;
  pushAppointmentStatus(a, 'annulee', by, reason);
  await a.save();
  notifyStatus(a);
  return loadAppointmentDto(a._id);
}

/** Rappel la veille : interventions qui commencent dans 23 à 25 h, une seule fois. */
export async function sendReminders(now = new Date()) {
  const due = await Appointment.find({
    status: trusted({ $in: ['demande_recue', 'planifiee'] }),
    reminderSentAt: null,
    start: trusted({
      $gte: new Date(now.getTime() + 23 * 3600_000),
      $lte: new Date(now.getTime() + 25 * 3600_000),
    }),
  });
  for (const a of due) {
    a.reminderSentAt = now;
    await a.save();
    inBackground(
      sendTemplatedMail({
        to: a.contact.email,
        subject: `Rappel : intervention demain (${a.reference})`,
        greeting: `Bonjour ${a.contact.name.split(' ')[0]},`,
        paragraphs: [
          `Nous vous rappelons votre intervention ${INTERVENTION_MODE_LABELS[a.mode].toLowerCase()} prévue le ${when(a.start)}.`,
          'Un empêchement ? Vous pouvez reporter ou annuler depuis votre espace, ou nous contacter.',
        ],
        action: { label: 'Voir le rendez-vous', url: trackingUrl(a) },
      }),
      'Email de rappel',
    );
  }
  if (due.length) logger.info({ count: due.length }, 'Rappels d’intervention envoyés');
  return due.length;
}
