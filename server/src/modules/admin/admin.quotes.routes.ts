import {
  adminQuoteSendSchema,
  adminQuoteUpdateSchema,
  quoteListQuerySchema,
  type AdminQuoteDto,
  type Paginated,
} from '@kodav/shared';
import { Router } from 'express';
import { trusted, type QueryFilter } from 'mongoose';
import { audit } from '../../lib/audit.js';
import { AppError, sendOk } from '../../lib/http.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { getPublicSettings } from '../settings/settings.service.js';
import { Quote, toAdminQuoteDto, type QuoteDoc } from '../quotes/quote.model.js';
import { renderQuotePdf } from '../quotes/quote.pdf.js';
import { applyAdminUpdate, loadQuoteDto, sendQuote } from '../quotes/quote.service.js';

export const adminQuotesRouter = Router();
adminQuotesRouter.use(authenticate, requireRole('admin'));

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function findQuote(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw AppError.notFound('Devis introuvable');
  const quote = await Quote.findOne({ _id: id, status: trusted({ $ne: 'brouillon' }) });
  if (!quote) throw AppError.notFound('Devis introuvable');
  return quote;
}

async function adminDto(id: unknown) {
  const quote = await Quote.findById(id).populate('organization', 'name').lean();
  return toAdminQuoteDto(quote!);
}

adminQuotesRouter.get('/', async (req, res) => {
  const { page, limit, status, q } = quoteListQuerySchema.parse(req.query);
  const search = q ? trusted({ $regex: escapeRegex(q), $options: 'i' }) : null;
  const filter: QueryFilter<QuoteDoc> = {
    status: status ?? trusted({ $ne: 'brouillon' as const }),
    ...(search
      ? {
          $or: [
            { reference: search },
            { 'contact.name': search },
            { 'contact.email': search },
            { 'contact.company': search },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    Quote.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('organization', 'name')
      .lean(),
    Quote.countDocuments(filter),
  ]);
  sendOk(res, {
    items: items.map(toAdminQuoteDto),
    page,
    limit,
    total,
  } satisfies Paginated<AdminQuoteDto>);
});

adminQuotesRouter.get('/:id', async (req, res) => {
  const quote = await findQuote(req.params.id);
  sendOk(res, await adminDto(quote._id));
});

adminQuotesRouter.patch('/:id', async (req, res) => {
  const quote = await findQuote(req.params.id);
  const input = adminQuoteUpdateSchema.parse(req.body);
  applyAdminUpdate(quote, input);
  await quote.save();
  await audit(
    req,
    'quote.update',
    'Quote',
    quote._id,
    `${quote.reference} : ${quote.finalTotals?.total ?? 0} FCFA`,
  );
  sendOk(res, await adminDto(quote._id));
});

adminQuotesRouter.post('/:id/send', async (req, res) => {
  const quote = await findQuote(req.params.id);
  await sendQuote(quote, req.user!, adminQuoteSendSchema.parse(req.body ?? {}));
  await audit(req, 'quote.send', 'Quote', quote._id, quote.reference ?? '');
  sendOk(res, await adminDto(quote._id));
});

adminQuotesRouter.get('/:id/pdf', async (req, res) => {
  const quote = await findQuote(req.params.id);
  const dto = await loadQuoteDto(quote._id);
  const pdf = await renderQuotePdf(dto, (await getPublicSettings()).brand);
  res
    .type('application/pdf')
    .set('Content-Disposition', `inline; filename="${dto.reference}.pdf"`)
    .set('Cache-Control', 'private, no-store')
    .send(pdf);
});
