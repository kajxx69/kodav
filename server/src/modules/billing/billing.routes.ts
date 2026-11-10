import {
  createInvoiceSchema,
  invoiceListQuerySchema,
  paymentInputSchema,
  type InvoiceDto,
  type Paginated,
} from '@kodav/shared';
import { Router, type Response } from 'express';
import { trusted, type QueryFilter } from 'mongoose';
import { audit } from '../../lib/audit.js';
import { AppError, sendOk } from '../../lib/http.js';
import { authenticate, requireRole, type RequestUser } from '../../middlewares/auth.js';
import { Appointment, InterventionReport } from '../appointments/appointment.model.js';
import { Quote } from '../quotes/quote.model.js';
import { Invoice, type InvoiceDoc } from './billing.model.js';
import {
  addPayment,
  cancelInvoice,
  createInvoiceFromQuote,
  invoicePdf,
  loadInvoiceDto,
  toInvoiceDto,
} from './billing.service.js';

const ID = /^[a-f\d]{24}$/i;

function ownerFilter(user: RequestUser) {
  const or: Record<string, unknown>[] = [{ client: user._id }];
  if (user.organization) or.push({ organization: user.organization });
  return { $or: or };
}

async function sendPdf(dto: InvoiceDto, res: Response) {
  res
    .type('application/pdf')
    .set('Content-Disposition', `inline; filename="${dto.reference}.pdf"`)
    .set('Cache-Control', 'private, no-store')
    .send(await invoicePdf(dto));
}

// --- Client ----------------------------------------------------------------------

export const invoicesRouter = Router();
invoicesRouter.use(authenticate, requireRole('client'));

invoicesRouter.get('/', async (req, res) => {
  const items = await Invoice.find({
    ...ownerFilter(req.user!),
    paymentStatus: trusted({ $ne: 'annulee' }),
  })
    .sort({ issuedAt: -1 })
    .populate('quote', 'reference')
    .lean();
  sendOk(
    res,
    items.map((i) => toInvoiceDto(i as Parameters<typeof toInvoiceDto>[0])),
  );
});

invoicesRouter.get('/:id/pdf', async (req, res) => {
  if (!ID.test(String(req.params.id))) throw AppError.notFound('Facture introuvable');
  const found = await Invoice.exists({ _id: req.params.id, ...ownerFilter(req.user!) });
  if (!found) throw AppError.notFound('Facture introuvable');
  await sendPdf(await loadInvoiceDto(String(req.params.id)), res);
});

/** « Mes documents » : devis, rapports signés et factures, avec le lien vers chaque PDF. */
export const documentsRouter = Router();
documentsRouter.use(authenticate, requireRole('client'));

documentsRouter.get('/', async (req, res) => {
  const owner = ownerFilter(req.user!);
  const [quotes, appointments, invoices] = await Promise.all([
    Quote.find(
      { ...owner, status: trusted({ $ne: 'brouillon' }) },
      { reference: 1, status: 1, submittedAt: 1, sentAt: 1 },
    )
      .sort({ createdAt: -1 })
      .lean(),
    Appointment.find(owner, { reference: 1, start: 1 }).lean(),
    Invoice.find(
      { ...owner, paymentStatus: trusted({ $ne: 'annulee' }) },
      { reference: 1, issuedAt: 1, total: 1, paymentStatus: 1 },
    )
      .sort({ issuedAt: -1 })
      .lean(),
  ]);
  const signed = await InterventionReport.find(
    { appointment: trusted({ $in: appointments.map((a) => a._id) }), status: 'signe' },
    { appointment: 1, 'signature.signedAt': 1 },
  ).lean();
  const byId = new Map(appointments.map((a) => [String(a._id), a]));
  sendOk(
    res,
    [
      ...invoices.map((i) => ({
        kind: 'facture' as const,
        id: String(i._id),
        reference: i.reference,
        date: i.issuedAt.toISOString(),
        detail: `${i.total} FCFA`,
        status: i.paymentStatus,
        pdf: `/invoices/${String(i._id)}/pdf`,
      })),
      ...quotes.map((q) => ({
        kind: 'devis' as const,
        id: String(q._id),
        reference: q.reference ?? '',
        date: (q.sentAt ?? q.submittedAt ?? new Date()).toISOString(),
        detail: q.status,
        status: q.status,
        pdf: `/quotes/${String(q._id)}/pdf`,
      })),
      ...signed.map((r) => {
        const a = byId.get(String(r.appointment))!;
        return {
          kind: 'rapport' as const,
          id: String(a._id),
          reference: a.reference,
          date: (
            (r as { signature?: { signedAt?: Date } }).signature?.signedAt ?? a.start
          ).toISOString(),
          detail: 'Rapport d’intervention signé',
          status: 'signe',
          pdf: `/appointments/${String(a._id)}/report/pdf`,
        };
      }),
    ].sort((a, b) => b.date.localeCompare(a.date)),
  );
});

// --- Admin -------------------------------------------------------------------------

export const adminInvoicesRouter = Router();
adminInvoicesRouter.use(authenticate, requireRole('admin'));

adminInvoicesRouter.get('/', async (req, res) => {
  const { page, limit, status, q } = invoiceListQuerySchema.parse(req.query);
  const filter: QueryFilter<InvoiceDoc> = {};
  if (status) filter.paymentStatus = status;
  if (q) {
    const rx = trusted({ $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' });
    filter.$or = [
      { reference: rx },
      { 'billingSnapshot.name': rx },
      { 'billingSnapshot.company': rx },
    ];
  }
  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .sort({ issuedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('quote', 'reference')
      .lean(),
    Invoice.countDocuments(filter),
  ]);
  sendOk(res, {
    items: items.map((i) => toInvoiceDto(i as Parameters<typeof toInvoiceDto>[0])),
    page,
    limit,
    total,
  } satisfies Paginated<InvoiceDto>);
});

adminInvoicesRouter.post('/from-quote/:quoteId', async (req, res) => {
  if (!ID.test(String(req.params.quoteId))) throw AppError.notFound('Devis introuvable');
  const { dueDays } = createInvoiceSchema.parse(req.body ?? {});
  const dto = await createInvoiceFromQuote(String(req.params.quoteId), dueDays);
  await audit(
    req,
    'invoice.create',
    'Invoice',
    dto.id,
    `${dto.reference} depuis ${dto.quote.reference}, ${dto.total} FCFA`,
  );
  sendOk(res, dto, 201);
});

adminInvoicesRouter.get('/:id', async (req, res) => {
  if (!ID.test(String(req.params.id))) throw AppError.notFound('Facture introuvable');
  sendOk(res, await loadInvoiceDto(String(req.params.id)));
});

adminInvoicesRouter.get('/:id/pdf', async (req, res) => {
  if (!ID.test(String(req.params.id))) throw AppError.notFound('Facture introuvable');
  await sendPdf(await loadInvoiceDto(String(req.params.id)), res);
});

adminInvoicesRouter.post('/:id/payments', async (req, res) => {
  if (!ID.test(String(req.params.id))) throw AppError.notFound('Facture introuvable');
  const input = paymentInputSchema.parse(req.body);
  const dto = await addPayment(String(req.params.id), input, req.user!._id);
  await audit(
    req,
    'invoice.payment',
    'Invoice',
    dto.id,
    `${dto.reference} : ${input.amount} FCFA (${input.method})`,
  );
  sendOk(res, dto, 201);
});

adminInvoicesRouter.post('/:id/cancel', async (req, res) => {
  if (!ID.test(String(req.params.id))) throw AppError.notFound('Facture introuvable');
  const dto = await cancelInvoice(String(req.params.id));
  await audit(req, 'invoice.cancel', 'Invoice', dto.id, dto.reference);
  sendOk(res, dto);
});

/** Formule de maintenance en cours du client (organisation ou particulier). */
export const subscriptionsRouter = Router();
subscriptionsRouter.get('/me', authenticate, requireRole('client'), async (req, res) => {
  const { activeSubscription } = await import('./billing.service.js');
  const user = req.user!;
  sendOk(
    res,
    await activeSubscription(
      user.organization ? { organization: user.organization } : { client: user._id },
    ),
  );
});
