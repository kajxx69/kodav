import {
  formatFcfa,
  type InvoiceDto,
  type SubscriptionDto,
  type TicketPriority,
} from '@kodav/shared';
import { trusted, type Types } from 'mongoose';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { nextReference } from '../../lib/counter.js';
import { AppError } from '../../lib/http.js';
import { sendTemplatedMail } from '../../lib/mailer.js';
import { notify } from '../notifications/notification.service.js';
import { Organization } from '../organizations/organization.model.js';
import { Plan } from '../plans/plans.model.js';
import { Quote } from '../quotes/quote.model.js';
import { SETTINGS_KEY, Settings } from '../settings/settings.model.js';
import { getPublicSettings } from '../settings/settings.service.js';
import { Invoice, Subscription, type InvoiceDoc, type SubscriptionDoc } from './billing.model.js';
import { renderInvoicePdf } from './invoice.pdf.js';

type LeanInvoice = InvoiceDoc & { _id: Types.ObjectId };
const paidOf = (i: Pick<InvoiceDoc, 'payments'>) =>
  i.payments.reduce((sum, p) => sum + p.amount, 0);

export function toInvoiceDto(
  i: LeanInvoice & { quote: Types.ObjectId | { _id: Types.ObjectId; reference: string } },
): InvoiceDto {
  const quote = i.quote as { _id: Types.ObjectId; reference?: string };
  return {
    id: String(i._id),
    reference: i.reference,
    quote: { id: String(quote._id ?? i.quote), reference: quote.reference ?? '' },
    billing: { ...i.billingSnapshot },
    items: i.items.map(({ label, description, quantity, unitLabel, unitPrice, total }) => ({
      label,
      description,
      quantity,
      unitLabel,
      unitPrice,
      total,
    })),
    subtotal: i.subtotal,
    discount: i.discount,
    travelFee: i.travelFee,
    taxRate: i.taxRate,
    taxAmount: i.taxAmount,
    total: i.total,
    paid: paidOf(i),
    issuedAt: i.issuedAt.toISOString(),
    dueAt: i.dueAt.toISOString(),
    status: i.paymentStatus,
    overdue: ['impayee', 'partielle'].includes(i.paymentStatus) && i.dueAt < new Date(),
    payments: i.payments.map((p) => ({
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      paidAt: p.paidAt.toISOString(),
    })),
    hasAccount: Boolean(i.client),
  };
}

export async function loadInvoiceDto(id: Types.ObjectId | string) {
  const i = await Invoice.findById(id).populate('quote', 'reference').lean();
  if (!i) throw AppError.notFound('Facture introuvable');
  return toInvoiceDto(i as Parameters<typeof toInvoiceDto>[0]);
}

export async function invoicePdf(dto: InvoiceDto) {
  const [{ brand }, settings] = await Promise.all([
    getPublicSettings(),
    Settings.findOne({ key: SETTINGS_KEY }, { invoice: 1 }).lean(),
  ]);
  return renderInvoicePdf(dto, brand, {
    legalMentions: settings?.invoice?.legalMentions ?? '',
    bankDetails: settings?.invoice?.bankDetails ?? '',
  });
}

/** Facture d'un devis accepté : lignes et montants repris tels quels, TVA des paramètres. */
export async function createInvoiceFromQuote(quoteId: string, dueDays: number) {
  const quote = await Quote.findById(quoteId).populate('organization', 'name address').lean();
  if (!quote) throw AppError.notFound('Devis introuvable');
  if (quote.status !== 'accepte' || !quote.finalTotals) {
    throw AppError.conflict('Seul un devis accepté peut être facturé');
  }
  if (await Invoice.exists({ quote: quote._id }))
    throw AppError.conflict('Ce devis est déjà facturé');

  const settings = await Settings.findOne({ key: SETTINGS_KEY }, { invoice: 1 }).lean();
  const taxRate = settings?.invoice?.taxRate ?? 0;
  const t = quote.finalTotals;
  const base = t.subtotal - t.discount + t.travelFee;
  const taxAmount = Math.round((base * taxRate) / 100);
  const org = quote.organization as unknown as {
    name: string;
    address?: { street: string; commune: string; city: string };
  } | null;
  const address =
    [org?.address?.street, org?.address?.commune, org?.address?.city].filter(Boolean).join(', ') ||
    [quote.address, quote.commune].filter(Boolean).join(', ');
  const now = new Date();
  const invoice = await Invoice.create({
    reference: await nextReference('FAC', now),
    quote: quote._id,
    client: quote.client,
    organization: (quote.organization as unknown as { _id: Types.ObjectId } | null)?._id ?? null,
    billingSnapshot: {
      name: quote.contact.name,
      company: org?.name ?? quote.contact.company,
      email: quote.contact.email,
      phone: quote.contact.phone,
      address,
    },
    items: quote.finalItems,
    subtotal: t.subtotal,
    discount: t.discount,
    travelFee: t.travelFee,
    taxRate,
    taxAmount,
    total: base + taxAmount,
    issuedAt: now,
    dueAt: new Date(now.getTime() + dueDays * 86_400_000),
  });

  const dto = await loadInvoiceDto(invoice._id);
  void (async () => {
    const pdf = await invoicePdf(dto);
    await sendTemplatedMail({
      to: dto.billing.email,
      subject: `Facture ${dto.reference}`,
      template: {
        key: 'invoice_issued',
        vars: {
          prenom: dto.billing.name.split(' ')[0] ?? '',
          reference: dto.reference,
          montant: formatFcfa(dto.total),
          echeance: new Date(dto.dueAt).toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' }),
        },
      },
      greeting: `Bonjour ${dto.billing.name.split(' ')[0]},`,
      paragraphs: [
        `Veuillez trouver ci-joint la facture ${dto.reference} d’un montant de ${formatFcfa(dto.total)}, relative au devis ${dto.quote.reference}.`,
        `Échéance : ${new Date(dto.dueAt).toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' })}. Les modalités de règlement figurent sur la facture.`,
      ],
      action: dto.hasAccount
        ? { label: 'Voir mes documents', url: `${env.CLIENT_URL}/espace-client/documents` }
        : undefined,
      attachments: [
        { filename: `${dto.reference}.pdf`, content: pdf, contentType: 'application/pdf' },
      ],
    });
    if (quote.client) {
      await notify([quote.client], {
        type: 'quote_sent',
        title: `Facture ${dto.reference} disponible`,
        body: formatFcfa(dto.total),
        link: '/espace-client/documents',
      });
    }
  })().catch((err: unknown) => logger.error({ err }, 'Envoi de la facture'));
  return dto;
}

export async function addPayment(
  id: string,
  input: {
    amount: number;
    method: InvoiceDoc['payments'][number]['method'];
    reference: string;
    paidAt: string;
  },
  by: Types.ObjectId,
) {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw AppError.notFound('Facture introuvable');
  if (['payee', 'annulee'].includes(invoice.paymentStatus)) {
    throw AppError.conflict('Cette facture est déjà soldée ou annulée');
  }
  const remaining = invoice.total - paidOf(invoice);
  if (input.amount > remaining) {
    throw AppError.badRequest(`Le montant dépasse le reste à payer (${formatFcfa(remaining)})`, [
      { path: 'amount', message: `Reste à payer : ${formatFcfa(remaining)}` },
    ]);
  }
  invoice.payments.push({ ...input, paidAt: new Date(input.paidAt), recordedBy: by });
  invoice.paymentStatus = input.amount === remaining ? 'payee' : 'partielle';
  await invoice.save();
  return loadInvoiceDto(invoice._id);
}

export async function cancelInvoice(id: string) {
  const invoice = await Invoice.findById(id);
  if (!invoice) throw AppError.notFound('Facture introuvable');
  if (invoice.payments.length) {
    throw AppError.conflict('Une facture avec des règlements ne peut pas être annulée');
  }
  invoice.paymentStatus = 'annulee';
  await invoice.save();
  return loadInvoiceDto(invoice._id);
}

// --- Abonnements ----------------------------------------------------------------------

type LeanPlan = { _id: Types.ObjectId; name: string; sla: SubscriptionDto['plan']['sla'] };

export function toSubscriptionDto(
  s: SubscriptionDoc & { _id: Types.ObjectId; plan: LeanPlan | Types.ObjectId },
): SubscriptionDto {
  const plan = s.plan as LeanPlan;
  return {
    id: String(s._id),
    plan: { id: String(plan._id), name: plan.name, sla: plan.sla },
    seats: s.seats,
    billingCycle: s.billingCycle,
    startDate: s.startDate.toISOString().slice(0, 10),
    endDate: s.endDate?.toISOString().slice(0, 10) ?? null,
    status: s.status,
    monthlyPrice: s.priceSnapshot,
  };
}

/** Abonnement en cours d'un client (organisation d'abord, sinon particulier). */
export async function activeSubscription(owner: {
  organization?: Types.ObjectId | null;
  client?: Types.ObjectId | null;
}) {
  const today = new Date();
  const filter = owner.organization
    ? { organization: owner.organization }
    : { client: owner.client };
  if (!filter.organization && !filter.client) return null;
  const sub = await Subscription.findOne({
    ...filter,
    status: 'active',
    startDate: trusted({ $lte: today }),
    $or: [{ endDate: null }, { endDate: trusted({ $gte: today }) }],
  })
    .sort({ startDate: -1 })
    .populate('plan', 'name sla')
    .lean();
  return sub ? toSubscriptionDto(sub as Parameters<typeof toSubscriptionDto>[0]) : null;
}

/** Délai cible d'un ticket : celui de la formule souscrite, à défaut celui sans contrat. */
export async function subscriptionSlaHours(
  owner: { organization?: Types.ObjectId | null; client?: Types.ObjectId | null },
  priority: TicketPriority,
) {
  const sub = await activeSubscription(owner);
  return sub?.plan.sla[priority] ?? null;
}

export async function saveSubscription(
  owner: { organization: Types.ObjectId | null; client: Types.ObjectId | null },
  input: {
    planId: string;
    seats: number;
    billingCycle: 'mensuel' | 'annuel';
    startDate: string;
    endDate: string | null;
    status: SubscriptionDoc['status'];
  },
) {
  const plan = await Plan.findById(input.planId).lean();
  if (!plan) throw AppError.badRequest('Formule introuvable');
  if (input.seats < plan.minSeats || (plan.maxSeats && input.seats > plan.maxSeats)) {
    throw AppError.badRequest(
      `La formule ${plan.name} couvre ${plan.minSeats}${plan.maxSeats ? ` à ${plan.maxSeats}` : ' postes et plus'}`,
      [{ path: 'seats', message: 'Nombre de postes hors de la formule' }],
    );
  }
  // Une seule formule active : la précédente est résiliée.
  if (input.status === 'active') {
    await Subscription.updateMany(
      { ...owner, status: 'active' },
      { status: 'resiliee', endDate: new Date() },
    );
  }
  const monthly = plan.basePriceMonthly + plan.pricePerSeatMonthly * input.seats;
  const price =
    input.billingCycle === 'annuel'
      ? Math.round(monthly * (1 - plan.annualDiscountPercent / 100))
      : monthly;
  const sub = await Subscription.create({
    ...owner,
    plan: plan._id,
    seats: input.seats,
    billingCycle: input.billingCycle,
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : null,
    status: input.status,
    priceSnapshot: price,
  });
  if (owner.organization) {
    await Organization.updateOne(
      { _id: owner.organization },
      { activeSubscription: input.status === 'active' ? sub._id : null },
    );
  }
  return activeSubscription(owner);
}
