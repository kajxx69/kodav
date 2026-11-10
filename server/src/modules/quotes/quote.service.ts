import type { quoteSubmitInputSchema } from '@kodav/shared';
import { type AdminQuoteUpdateInput, type QuoteDto, type QuoteStatus } from '@kodav/shared';
import { trusted, type QueryFilter, type Types } from 'mongoose';
import type { z } from 'zod';
import { logger } from '../../config/logger.js';
import { nextReference } from '../../lib/counter.js';
import { generateToken, hashToken } from '../../lib/crypto.js';
import { AppError } from '../../lib/http.js';
import type { RequestUser } from '../../middlewares/auth.js';
import { AuthToken } from '../auth/authToken.model.js';
import { Lead } from '../leads/lead.model.js';
import { estimate } from '../pricing/pricing.service.js';
import { Settings, SETTINGS_KEY } from '../settings/settings.model.js';
import {
  sendQuoteReceivedEmail,
  sendQuoteSentEmail,
  sendTeamDecisionEmail,
  sendTeamNewQuoteEmail,
} from './quote.emails.js';
import { Quote, pushStatus, toQuoteDto, type QuoteDoc, type QuoteDocument } from './quote.model.js';

type SubmitInput = z.output<typeof quoteSubmitInputSchema>;

const populateOrg = { path: 'organization', select: 'name' } as const;

export async function loadQuoteDto(id: Types.ObjectId | string): Promise<QuoteDto> {
  const quote = await Quote.findById(id).populate(populateOrg).lean();
  if (!quote) throw AppError.notFound('Devis introuvable');
  return toQuoteDto(quote);
}

/** Les emails partent après la réponse : un SMTP lent ne bloque pas l'utilisateur. */
function inBackground(task: Promise<unknown>, what: string) {
  task.catch((err: unknown) => logger.error({ err }, what));
}

export async function submitQuote(input: SubmitInput, user: RequestUser | null) {
  const { website: _website, consent: _consent, contact, items, ...rest } = input;
  const computed = await estimate({
    items,
    urgency: rest.urgency,
    mode: rest.mode,
    commune: rest.commune,
  });
  const asClient = user?.role === 'client' ? user : null;

  const now = new Date();
  const quote = new Quote({
    ...rest,
    commune: rest.commune ?? null,
    reference: await nextReference('DEV', now),
    client: asClient?._id ?? null,
    organization: asClient?.organization ?? null,
    contact,
    request: items,
    estimate: computed,
    submittedAt: now,
    statusHistory: [],
  });
  pushStatus(quote, 'soumis', asClient?._id ?? null);

  if (!asClient) {
    const lead = await Lead.create({
      source: 'devis_visiteur',
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      profile: contact.profile,
      commune: rest.commune,
      subject: `Demande de devis ${quote.reference}`,
      message: rest.clientNotes,
      payload: { quoteReference: quote.reference },
      consentAt: now,
    });
    quote.lead = lead._id;
  }
  await quote.save();
  if (asClient) await Quote.deleteOne({ client: asClient._id, status: 'brouillon' });

  const dto = await loadQuoteDto(quote._id);
  inBackground(
    Promise.all([sendQuoteReceivedEmail(dto), sendTeamNewQuoteEmail(dto)]),
    'Emails de nouvelle demande de devis',
  );
  return dto;
}

/** Filtre de propriété : le client voit ses devis et ceux de son organisation. */
export function ownershipFilter(user: RequestUser, status?: QuoteStatus): QueryFilter<QuoteDoc> {
  const or: QueryFilter<QuoteDoc>[] = [{ client: user._id }];
  if (user.organization) or.push({ organization: user.organization });
  return { $or: or, status: status ?? trusted({ $ne: 'brouillon' as const }) };
}

export async function findOwnedQuote(id: unknown, user: RequestUser) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw AppError.notFound('Devis introuvable');
  }
  const quote = await Quote.findOne({ _id: id, ...ownershipFilter(user) });
  if (!quote) throw AppError.notFound('Devis introuvable');
  return quote;
}

function isExpired(quote: QuoteDocument) {
  return quote.status === 'envoye' && quote.validUntil !== null && quote.validUntil <= new Date();
}

/** Acceptation ou refus d'un devis envoyé (espace client ou lien reçu par email). */
export async function decideQuote(
  quote: QuoteDocument,
  decision: 'accept' | 'decline',
  reason: string,
  by: Types.ObjectId | null,
) {
  if (isExpired(quote)) {
    pushStatus(quote, 'expire', null, 'Date de validité dépassée');
    await quote.save();
    throw AppError.conflict('Ce devis a expiré. Contactez-nous pour en obtenir un nouveau.');
  }
  if (quote.status !== 'envoye') {
    throw AppError.conflict('Ce devis ne peut plus être accepté ou refusé');
  }
  quote.decidedAt = new Date();
  quote.decisionReason = reason;
  pushStatus(quote, decision === 'accept' ? 'accepte' : 'refuse', by, reason);
  await quote.save();
  await AuthToken.deleteMany({ type: 'quote_action', 'meta.quoteId': String(quote._id) });

  const dto = await loadQuoteDto(quote._id);
  inBackground(sendTeamDecisionEmail(dto), 'Email de décision sur devis');
  return dto;
}

/** Lignes définitives saisies par l'admin : totaux recalculés côté serveur. */
export function applyAdminUpdate(quote: QuoteDocument, input: Required<AdminQuoteUpdateInput>) {
  if (['accepte', 'refuse', 'expire'].includes(quote.status)) {
    throw AppError.conflict('Ce devis est clos et ne peut plus être modifié');
  }
  const items = input.finalItems.map((i) => {
    const quantity = Number(i.quantity);
    const unitPrice = Number(i.unitPrice);
    return {
      label: i.label,
      description: i.description ?? '',
      quantity,
      unitLabel: i.unitLabel ?? '',
      unitPrice,
      total: quantity * unitPrice,
    };
  });
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const discount = Number(input.discount);
  const travelFee = Number(input.travelFee);
  if (discount > subtotal) throw AppError.badRequest('La remise dépasse le sous-total');
  quote.set({
    finalItems: items,
    finalTotals: { subtotal, discount, travelFee, total: subtotal - discount + travelFee },
    adminNotes: input.adminNotes,
  });
  if (quote.status === 'soumis') pushStatus(quote, 'en_revue');
}

export async function sendQuote(
  quote: QuoteDocument,
  admin: RequestUser,
  options: { validityDays?: number; message: string },
) {
  if (!['soumis', 'en_revue', 'envoye'].includes(quote.status)) {
    throw AppError.conflict('Ce devis est clos et ne peut plus être envoyé');
  }
  if (!quote.finalItems.length || !quote.finalTotals?.total) {
    throw AppError.badRequest('Renseignez les lignes et le montant définitifs avant l’envoi');
  }
  const settings = await Settings.findOne({ key: SETTINGS_KEY }, { quote: 1 }).lean();
  const days = options.validityDays ?? settings?.quote?.validityDays ?? 30;
  const now = new Date();
  quote.validUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  quote.sentAt = now;
  pushStatus(quote, 'envoye', admin._id, quote.status === 'envoye' ? 'Renvoi' : '');
  await quote.save();

  // Lien d'acceptation à usage unique, valable jusqu'à la fin de validité du devis.
  const token = generateToken();
  await AuthToken.deleteMany({ type: 'quote_action', 'meta.quoteId': String(quote._id) });
  await AuthToken.create({
    user: quote.client ?? admin._id,
    type: 'quote_action',
    tokenHash: hashToken(token),
    expiresAt: quote.validUntil,
    meta: { quoteId: String(quote._id) },
  });

  const dto = await loadQuoteDto(quote._id);
  await sendQuoteSentEmail(dto, token, options.message);
  return dto;
}

/** Devis pointé par un lien email, sans le consommer (affichage avant décision). */
export async function findQuoteByActionToken(token: string) {
  const doc = await AuthToken.findOne({
    tokenHash: hashToken(token),
    type: 'quote_action',
    usedAt: null,
    expiresAt: trusted({ $gt: new Date() }),
  }).lean();
  const quoteId = (doc?.meta as { quoteId?: string } | null)?.quoteId;
  const quote = quoteId ? await Quote.findById(quoteId) : null;
  if (!quote) throw new AppError(400, 'INVALID_TOKEN', 'Ce lien est invalide ou a expiré');
  return quote;
}

/** Passage automatique en « expiré » des devis envoyés dont la validité est dépassée. */
export async function expireQuotes(now = new Date()) {
  const res = await Quote.updateMany(
    { status: 'envoye', validUntil: trusted({ $lte: now }) },
    {
      $set: { status: 'expire' },
      $push: {
        statusHistory: { status: 'expire', at: now, by: null, note: 'Date de validité dépassée' },
      },
    },
  );
  if (res.modifiedCount) logger.info({ count: res.modifiedCount }, 'Devis expirés');
  return res.modifiedCount;
}

/** Après confirmation de l'email, les demandes faites sans compte sont rattachées au client. */
export async function attachVisitorQuotes(user: {
  _id: Types.ObjectId;
  email: string;
  role: string;
  organization?: Types.ObjectId | null;
}) {
  if (user.role !== 'client') return 0;
  const res = await Quote.updateMany(
    { client: null, 'contact.email': user.email },
    { client: user._id, organization: user.organization ?? null },
  );
  return res.modifiedCount;
}
