import { reportDraftSchema, signReportSchema, technicianStatusSchema } from '@kodav/shared';
import { Router } from 'express';
import { trusted } from 'mongoose';
import { z } from 'zod';
import { AppError, sendOk } from '../../lib/http.js';
import { assertImage, deleteFile, imageUpload, saveFile } from '../../lib/storage.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { InterventionReport, pushAppointmentStatus } from './appointment.model.js';
import {
  findOwnedAppointment,
  loadAppointmentDto,
  loadAppointmentDtos,
  notifyStatus,
} from './appointment.service.js';

export const technicianRouter = Router();
technicianRouter.use(authenticate, requireRole('technicien', 'admin'));

const MAX_PHOTOS = 6;

/** Passages autorisés en un geste depuis le téléphone. */
const NEXT: Record<string, string[]> = {
  en_route: ['planifiee'],
  en_cours: ['planifiee', 'en_route'],
  terminee: ['en_cours'],
};

technicianRouter.get('/appointments', async (req, res) => {
  const { range } = z.object({ range: z.enum(['day', 'week']).default('day') }).parse(req.query);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + (range === 'day' ? 1 : 7) * 24 * 3600_000);
  sendOk(
    res,
    await loadAppointmentDtos({
      technician: req.user!._id,
      status: trusted({ $ne: 'annulee' }),
      start: trusted({ $gte: start, $lt: end }),
    }),
  );
});

technicianRouter.get('/appointments/:id', async (req, res) => {
  const a = await findOwnedAppointment(req.params.id, req.user!);
  sendOk(res, await loadAppointmentDto(a._id));
});

technicianRouter.patch('/appointments/:id/status', async (req, res) => {
  const { status } = technicianStatusSchema.parse(req.body);
  const a = await findOwnedAppointment(req.params.id, req.user!);
  if (!NEXT[status]!.includes(a.status)) {
    throw AppError.conflict('Ce changement de statut n’est pas possible maintenant');
  }
  pushAppointmentStatus(a, status, req.user!._id);
  await a.save();
  notifyStatus(a);
  sendOk(res, await loadAppointmentDto(a._id));
});

async function editableReport(
  appointmentId: unknown,
  user: Parameters<typeof findOwnedAppointment>[1],
) {
  const a = await findOwnedAppointment(appointmentId, user);
  if (!['en_cours', 'terminee'].includes(a.status)) {
    throw AppError.conflict('Le rapport se remplit pendant ou après l’intervention');
  }
  let report = await InterventionReport.findOne({ appointment: a._id });
  if (report?.status === 'signe')
    throw AppError.conflict('Le rapport est signé et ne peut plus être modifié');
  report ??= new InterventionReport({ appointment: a._id, technician: user._id });
  return { a, report };
}

technicianRouter.put('/appointments/:id/report', async (req, res) => {
  const { a, report } = await editableReport(req.params.id, req.user!);
  report.set(reportDraftSchema.parse(req.body));
  await report.save();
  sendOk(res, await loadAppointmentDto(a._id));
});

technicianRouter.post(
  '/appointments/:id/report/photos',
  imageUpload.array('photos', MAX_PHOTOS),
  async (req, res) => {
    const { a, report } = await editableReport(req.params.id, req.user!);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw AppError.badRequest('Aucune photo reçue');
    if (report.photos.length + files.length > MAX_PHOTOS) {
      throw AppError.badRequest(`${MAX_PHOTOS} photos au maximum par rapport`);
    }
    // Contrôle de toutes les photos avant d'en enregistrer une seule.
    const mimes = await Promise.all(files.map((f) => assertImage(f.buffer)));
    for (const [i, file] of files.entries()) {
      report.photos.push({ publicId: await saveFile(file.buffer, 'reports'), mime: mimes[i]! });
    }
    await report.save();
    sendOk(res, await loadAppointmentDto(a._id), 201);
  },
);

technicianRouter.delete('/appointments/:id/report/photos/:photoId', async (req, res) => {
  const { a, report } = await editableReport(req.params.id, req.user!);
  const publicId = `reports/${String(req.params.photoId)}`;
  if (!report.photos.some((p) => p.publicId === publicId))
    throw AppError.notFound('Photo introuvable');
  report.photos = report.photos.filter((p) => p.publicId !== publicId);
  await report.save();
  await deleteFile(publicId);
  sendOk(res, await loadAppointmentDto(a._id));
});

/** Signature du client à l'écran : rapport figé, intervention validée. */
technicianRouter.post('/appointments/:id/report/sign', async (req, res) => {
  const { signerName, signature } = signReportSchema.parse(req.body);
  const { a, report } = await editableReport(req.params.id, req.user!);
  if (a.status !== 'terminee')
    throw AppError.conflict('Passez l’intervention en « terminée » avant la signature');
  if (!report.workDone.trim()) {
    throw AppError.badRequest('Décrivez les travaux effectués avant la signature', [
      { path: 'workDone', message: 'Travaux effectués requis' },
    ]);
  }
  report.signature = { image: signature, signerName, signedAt: new Date() };
  report.status = 'signe';
  await report.save();
  pushAppointmentStatus(a, 'validee', req.user!._id, `Signé par ${signerName}`);
  await a.save();
  notifyStatus(a);
  sendOk(res, await loadAppointmentDto(a._id));
});
