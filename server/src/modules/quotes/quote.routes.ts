import {
  quoteDecisionInputSchema,
  quoteDraftSchema,
  quoteListQuerySchema,
  quoteSubmitInputSchema,
  type Paginated,
  type QuoteDto,
} from '@kodav/shared';
import { Router } from 'express';
import { AppError, sendOk } from '../../lib/http.js';
import { authenticate, optionalAuthenticate, requireRole } from '../../middlewares/auth.js';
import { authLimiter, publicFormLimiter } from '../../middlewares/rateLimit.js';
import { verifyTurnstile } from '../../middlewares/turnstile.js';
import { getPublicSettings } from '../settings/settings.service.js';
import { Quote, toQuoteDto } from './quote.model.js';
import { renderQuotePdf } from './quote.pdf.js';
import {
  decideQuote,
  findOwnedQuote,
  findQuoteByActionToken,
  loadQuoteDto,
  ownershipFilter,
  submitQuote,
} from './quote.service.js';

export const quotesRouter = Router();

const TOKEN_REGEX = /^[\w-]{20,128}$/;

function actionToken(value: unknown) {
  if (typeof value !== 'string' || !TOKEN_REGEX.test(value)) {
    throw new AppError(400, 'INVALID_TOKEN', 'Lien invalide');
  }
  return value;
}

quotesRouter.post(
  '/',
  publicFormLimiter,
  verifyTurnstile,
  optionalAuthenticate,
  async (req, res) => {
    const input = quoteSubmitInputSchema.parse(req.body);
    // Pot de miel rempli : réponse neutre, rien n'est enregistré.
    if (input.website) {
      sendOk(res, { received: true }, 201);
      return;
    }
    sendOk(res, await submitQuote(input, req.user ?? null), 201);
  },
);

// --- Lien de réponse reçu par email (sans compte) ---------------------------------

quotesRouter.get('/action/:token', authLimiter, async (req, res) => {
  const quote = await findQuoteByActionToken(actionToken(req.params.token));
  sendOk(res, await loadQuoteDto(quote._id));
});

quotesRouter.post('/action/:token', authLimiter, async (req, res) => {
  const token = actionToken(req.params.token);
  const { decision, reason } = quoteDecisionInputSchema.parse(req.body);
  const quote = await findQuoteByActionToken(token);
  sendOk(res, await decideQuote(quote, decision, reason, null));
});

// --- Espace client -------------------------------------------------------------------

const clientOnly = [authenticate, requireRole('client')];

quotesRouter.get('/draft', ...clientOnly, async (req, res) => {
  const draft = await Quote.findOne({ client: req.user!._id, status: 'brouillon' }).lean();
  sendOk(res, draft?.draft ?? null);
});

quotesRouter.put('/draft', ...clientOnly, async (req, res) => {
  const draft = quoteDraftSchema.parse(req.body);
  await Quote.updateOne(
    { client: req.user!._id, status: 'brouillon' },
    {
      $set: { draft },
      // client et statut viennent du filtre lors de la création.
      $setOnInsert: { organization: req.user!.organization },
    },
    { upsert: true },
  );
  sendOk(res, draft);
});

quotesRouter.delete('/draft', ...clientOnly, async (req, res) => {
  await Quote.deleteOne({ client: req.user!._id, status: 'brouillon' });
  sendOk(res, { deleted: true });
});

quotesRouter.get('/', ...clientOnly, async (req, res) => {
  const { page, limit, status } = quoteListQuerySchema.parse(req.query);
  const filter = ownershipFilter(req.user!, status);
  const [items, total] = await Promise.all([
    Quote.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('organization', 'name')
      .lean(),
    Quote.countDocuments(filter),
  ]);
  sendOk(res, { items: items.map(toQuoteDto), page, limit, total } satisfies Paginated<QuoteDto>);
});

quotesRouter.get('/:id', ...clientOnly, async (req, res) => {
  const quote = await findOwnedQuote(req.params.id, req.user!);
  sendOk(res, await loadQuoteDto(quote._id));
});

quotesRouter.get('/:id/pdf', ...clientOnly, async (req, res) => {
  const quote = await findOwnedQuote(req.params.id, req.user!);
  const dto = await loadQuoteDto(quote._id);
  const pdf = await renderQuotePdf(dto, (await getPublicSettings()).brand);
  res
    .type('application/pdf')
    .set('Content-Disposition', `inline; filename="${dto.reference}.pdf"`)
    .set('Cache-Control', 'private, no-store')
    .send(pdf);
});

quotesRouter.post('/:id/decision', ...clientOnly, async (req, res) => {
  const { decision, reason } = quoteDecisionInputSchema.parse(req.body);
  const quote = await findOwnedQuote(req.params.id, req.user!);
  sendOk(res, await decideQuote(quote, decision, reason, req.user!._id));
});
