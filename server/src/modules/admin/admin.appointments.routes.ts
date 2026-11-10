import {
  adminAppointmentListSchema,
  adminAppointmentUpdateSchema,
  availabilitySettingsSchema,
  type AdminAppointmentDto,
} from '@kodav/shared';
import { Router } from 'express';
import { trusted } from 'mongoose';
import { audit } from '../../lib/audit.js';
import { AppError, sendOk } from '../../lib/http.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import {
  AVAILABILITY_KEY,
  Appointment,
  AvailabilitySettings,
  pushAppointmentStatus,
} from '../appointments/appointment.model.js';
import {
  cancelAppointment,
  getAvailability,
  loadAppointmentDto,
  loadAppointmentDtos,
  notifyStatus,
} from '../appointments/appointment.service.js';
import { User } from '../users/user.model.js';

export const adminAppointmentsRouter = Router();
adminAppointmentsRouter.use(authenticate, requireRole('admin'));

async function withNotes(dtos: Awaited<ReturnType<typeof loadAppointmentDtos>>) {
  const notes = await Appointment.find(
    { _id: trusted({ $in: dtos.map((d) => d.id) }) },
    { internalNotes: 1 },
  ).lean();
  const byId = new Map(notes.map((n) => [String(n._id), n.internalNotes]));
  return dtos.map((d): AdminAppointmentDto => ({ ...d, internalNotes: byId.get(d.id) ?? '' }));
}

adminAppointmentsRouter.get('/appointments', async (req, res) => {
  const { from, to, status, limit } = adminAppointmentListSchema.parse(req.query);
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.now() - 24 * 3600_000);
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date(start.getTime() + 14 * 24 * 3600_000);
  const dtos = await loadAppointmentDtos(
    { start: trusted({ $gte: start, $lte: end }), ...(status ? { status } : {}) },
    { start: 1 },
    limit,
  );
  sendOk(res, await withNotes(dtos));
});

adminAppointmentsRouter.patch('/appointments/:id', async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw AppError.notFound('Intervention introuvable');
  const input = adminAppointmentUpdateSchema.parse(req.body);
  const a = await Appointment.findById(req.params.id);
  if (!a) throw AppError.notFound('Intervention introuvable');

  if (input.status === 'annulee') {
    await cancelAppointment(a, 'Annulée par l’équipe', req.user!._id, true);
    await audit(req, 'appointment.cancel', 'Appointment', a._id, a.reference);
    sendOk(res, (await withNotes([await loadAppointmentDto(a._id)]))[0]);
    return;
  }
  if (['terminee', 'validee', 'annulee'].includes(a.status)) {
    throw AppError.conflict('Cette intervention est close');
  }
  if (input.technician !== undefined) {
    if (input.technician) {
      const tech = await User.exists({ _id: input.technician, role: 'technicien', isActive: true });
      if (!tech) throw AppError.badRequest('Technicien introuvable');
    }
    a.technician = input.technician ? (input.technician as unknown as typeof a.technician) : null;
  }
  if (input.start) {
    // L'équipe peut placer une intervention hors des créneaux publics (urgence, accord client).
    const duration = a.end.getTime() - a.start.getTime();
    a.rescheduledFrom = a.start;
    a.start = new Date(input.start);
    a.end = new Date(a.start.getTime() + duration);
    a.reminderSentAt = null;
  }
  if (input.internalNotes !== undefined) a.internalNotes = input.internalNotes;

  // Un technicien affecté (ou une confirmation explicite) planifie la demande.
  const planned =
    a.status === 'demande_recue' && (Boolean(a.technician) || input.status === 'planifiee');
  if (planned) pushAppointmentStatus(a, 'planifiee', req.user!._id);
  await a.save();
  if (planned || input.technician !== undefined || input.start) notifyStatus(a);
  await audit(
    req,
    'appointment.update',
    'Appointment',
    a._id,
    `${a.reference} : ${a.status}${input.start ? `, déplacé au ${a.start.toISOString()}` : ''}`,
  );
  sendOk(res, (await withNotes([await loadAppointmentDto(a._id)]))[0]);
});

adminAppointmentsRouter.get('/technicians', async (_req, res) => {
  const techs = await User.find(
    { role: 'technicien', isActive: true },
    { firstName: 1, lastName: 1, phone: 1 },
  )
    .sort({ firstName: 1 })
    .lean();
  sendOk(
    res,
    techs.map((t) => ({
      id: String(t._id),
      firstName: t.firstName,
      lastName: t.lastName,
      phone: t.phone,
    })),
  );
});

adminAppointmentsRouter.get('/availability', async (_req, res) => {
  sendOk(res, await getAvailability());
});

adminAppointmentsRouter.put('/availability', async (req, res) => {
  const settings = availabilitySettingsSchema.parse(req.body);
  await AvailabilitySettings.updateOne(
    { key: AVAILABILITY_KEY },
    { $set: settings },
    { upsert: true },
  );
  await audit(req, 'availability.update', 'AvailabilitySettings', req.user!._id);
  sendOk(res, await getAvailability());
});
