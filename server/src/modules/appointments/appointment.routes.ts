import {
  bookAppointmentSchema,
  cancelSchema,
  rescheduleSchema,
  slotQuerySchema,
  trackingLookupSchema,
  normalizeCiPhone,
  type TrackingDto,
} from '@kodav/shared';
import { Router, type Response } from 'express';
import { AppError, sendOk } from '../../lib/http.js';
import { signTrackingToken } from '../../lib/socket.js';
import { readFile } from '../../lib/storage.js';
import { authenticate, optionalAuthenticate, requireRole } from '../../middlewares/auth.js';
import { authLimiter, estimateLimiter, publicFormLimiter } from '../../middlewares/rateLimit.js';
import { verifyTurnstile } from '../../middlewares/turnstile.js';
import { getPublicSettings } from '../settings/settings.service.js';
import { Appointment, InterventionReport } from './appointment.model.js';
import {
  bookAppointment,
  cancelAppointment,
  clientFilter,
  findOwnedAppointment,
  listSlots,
  loadAppointmentDto,
  loadAppointmentDtos,
  rescheduleAppointment,
} from './appointment.service.js';
import { isoDate } from './availability.engine.js';
import { renderReportPdf } from './report.pdf.js';

// --- Disponibilités (public) ----------------------------------------------------------

export const availabilityRouter = Router();

availabilityRouter.get('/slots', estimateLimiter, async (req, res) => {
  const { from, days } = slotQuerySchema.parse(req.query);
  res.set('Cache-Control', 'no-store');
  sendOk(res, await listSlots(from ?? isoDate(new Date()), days));
});

/** Badge « Prochain créneau disponible » : premier créneau libre des 3 prochaines semaines. */
availabilityRouter.get('/next', estimateLimiter, async (_req, res) => {
  const days = await listSlots(isoDate(new Date()), 21);
  const next = days.flatMap((d) => d.slots).find((s) => s.available) ?? null;
  res.set('Cache-Control', 'public, max-age=60');
  sendOk(res, next);
});

// --- Rendez-vous ------------------------------------------------------------------

export const appointmentsRouter = Router();

appointmentsRouter.post(
  '/',
  publicFormLimiter,
  verifyTurnstile,
  optionalAuthenticate,
  async (req, res) => {
    const input = bookAppointmentSchema.parse(req.body);
    if (input.website) {
      sendOk(res, { received: true }, 201);
      return;
    }
    sendOk(res, await bookAppointment(input, req.user ?? null), 201);
  },
);

const clientOnly = [authenticate, requireRole('client')];

appointmentsRouter.get('/', ...clientOnly, async (req, res) => {
  sendOk(res, await loadAppointmentDtos(clientFilter(req.user!), { start: -1 }));
});

appointmentsRouter.get('/:id', authenticate, async (req, res) => {
  const a = await findOwnedAppointment(req.params.id, req.user!);
  sendOk(res, await loadAppointmentDto(a._id));
});

appointmentsRouter.post('/:id/reschedule', ...clientOnly, async (req, res) => {
  const { start } = rescheduleSchema.parse(req.body);
  const a = await findOwnedAppointment(req.params.id, req.user!);
  sendOk(res, await rescheduleAppointment(a, start, req.user!._id));
});

appointmentsRouter.post('/:id/cancel', ...clientOnly, async (req, res) => {
  const { reason } = cancelSchema.parse(req.body);
  const a = await findOwnedAppointment(req.params.id, req.user!);
  sendOk(res, await cancelAppointment(a, reason, req.user!._id));
});

async function sendReportPdf(appointmentId: unknown, res: Response) {
  const dto = await loadAppointmentDto(String(appointmentId));
  if (!dto.report) throw AppError.notFound('Aucun rapport pour cette intervention');
  const report = await InterventionReport.findOne({ appointment: dto.id })
    .select('+signature.image')
    .lean();
  const signature = report?.signature?.image
    ? Buffer.from(report.signature.image.split(',')[1]!, 'base64')
    : null;
  const photos = await Promise.all(
    (report?.photos ?? []).map((p) => readFile(p.publicId).catch(() => null)),
  );
  const pdf = await renderReportPdf(dto, (await getPublicSettings()).brand, {
    signature,
    photos: photos.filter((p): p is Buffer => Boolean(p)),
  });
  res
    .type('application/pdf')
    .set('Content-Disposition', `inline; filename="rapport-${dto.reference}.pdf"`)
    .set('Cache-Control', 'private, no-store')
    .send(pdf);
}

appointmentsRouter.get('/:id/report/pdf', authenticate, async (req, res) => {
  const a = await findOwnedAppointment(req.params.id, req.user!);
  await sendReportPdf(a._id, res);
});

appointmentsRouter.get('/:id/report/photos/:photoId', authenticate, async (req, res) => {
  const a = await findOwnedAppointment(req.params.id, req.user!);
  const report = await InterventionReport.findOne({ appointment: a._id }).lean();
  const photo = report?.photos.find((p) => p.publicId === `reports/${String(req.params.photoId)}`);
  if (!photo) throw AppError.notFound('Photo introuvable');
  res
    .type(photo.mime)
    .set('Cache-Control', 'private, max-age=3600')
    .send(await readFile(photo.publicId));
});

// --- Suivi public ----------------------------------------------------------------

export const trackingRouter = Router();

/** Référence + téléphone ou email : timeline sans données personnelles et jeton temps réel. */
trackingRouter.post('/lookup', authLimiter, async (req, res) => {
  const { reference, contact } = trackingLookupSchema.parse(req.body);
  const a = await Appointment.findOne({ reference })
    .populate('service', 'name')
    .populate('technician', 'firstName')
    .lean();
  const phone = normalizeCiPhone(contact);
  const matches =
    a &&
    (a.contact.email === contact.toLowerCase() || (phone !== null && a.contact.phone === phone));
  if (!a || !matches) {
    throw AppError.notFound('Aucune intervention ne correspond à ces informations');
  }
  const service = a.service as unknown as { name: string } | null;
  const technician = a.technician as unknown as { firstName: string } | null;
  sendOk(res, {
    reference: a.reference,
    status: a.status,
    statusHistory: a.statusHistory.map((h) => ({ status: h.status, at: h.at.toISOString() })),
    start: a.start.toISOString(),
    end: a.end.toISOString(),
    mode: a.mode,
    service: service?.name ?? null,
    technicianFirstName: technician?.firstName ?? null,
    trackingToken: signTrackingToken(String(a._id)),
  } satisfies TrackingDto);
});
