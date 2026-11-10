import {
  EXPORT_ENTITIES,
  adminCreateUserSchema,
  adminSettingsSchema,
  adminUpdateUserSchema,
  auditListQuerySchema,
  clientListQuerySchema,
  clientNotesSchema,
  dashboardQuerySchema,
  leadListQuerySchema,
  leadUpdateSchema,
  subscriptionInputSchema,
  type AdminSettingsDto,
  type AuditLogDto,
  type Client360Dto,
  type ClientSummaryDto,
  type DashboardDto,
  type ExportEntity,
  type LeadDto,
  type Paginated,
} from '@kodav/shared';
import { Router } from 'express';
import { trusted, type QueryFilter, type Types } from 'mongoose';
import { defaultBrand } from '../../config/brand.js';
import { audit } from '../../lib/audit.js';
import { createOneTimeToken } from '../auth/auth.service.js';
import { hashPassword, generateToken } from '../../lib/crypto.js';
import { AppError, sendOk } from '../../lib/http.js';
import { sendTemplatedMail } from '../../lib/mailer.js';
import { env } from '../../config/env.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { Appointment } from '../appointments/appointment.model.js';
import { Invoice, type InvoiceDoc } from '../billing/billing.model.js';
import { activeSubscription, saveSubscription } from '../billing/billing.service.js';
import { Lead } from '../leads/lead.model.js';
import { Organization } from '../organizations/organization.model.js';
import { Quote, type QuoteDoc } from '../quotes/quote.model.js';
import { SETTINGS_KEY, Settings } from '../settings/settings.model.js';
import { Asset, AuditLog, Ticket, type TicketDoc } from '../support/support.model.js';
import { User, type UserDoc } from '../users/user.model.js';

export const backofficeRouter = Router();
backofficeRouter.use(authenticate, requireRole('admin'));

const ID = /^[a-f\d]{24}$/i;
const rx = (q: string) =>
  trusted({ $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' });
const OPEN_TICKETS = trusted({ $in: ['ouvert', 'en_cours', 'attente_client'] });
const fullName = (u: { firstName: string; lastName: string }) =>
  `${u.firstName} ${u.lastName}`.trim();

// --- Prospects -----------------------------------------------------------------------

backofficeRouter.get('/leads', async (req, res) => {
  const { page, limit, status, source, q } = leadListQuerySchema.parse(req.query);
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (source) filter.source = source;
  if (q) filter.$or = [{ name: rx(q) }, { email: rx(q) }, { company: rx(q) }, { phone: rx(q) }];
  const [items, total] = await Promise.all([
    Lead.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('assignee', 'firstName lastName')
      .lean(),
    Lead.countDocuments(filter),
  ]);
  sendOk(res, {
    items: items.map((l): LeadDto => {
      const assignee = l.assignee as unknown as
        { _id: Types.ObjectId; firstName: string; lastName: string } | undefined;
      return {
        id: String(l._id),
        source: l.source,
        status: l.status,
        name: l.name,
        email: l.email,
        phone: l.phone,
        company: l.company,
        profile: l.profile ?? null,
        commune: l.commune ?? null,
        subject: l.subject ?? '',
        message: l.message,
        notes: l.notes ?? '',
        assignee: assignee ? { id: String(assignee._id), name: fullName(assignee) } : null,
        quoteReference:
          (l.payload as { quoteReference?: string } | undefined)?.quoteReference ?? null,
        createdAt: (l as unknown as { createdAt: Date }).createdAt.toISOString(),
      };
    }),
    page,
    limit,
    total,
  } satisfies Paginated<LeadDto>);
});

backofficeRouter.patch('/leads/:id', async (req, res) => {
  if (!ID.test(String(req.params.id))) throw AppError.notFound('Prospect introuvable');
  const input = leadUpdateSchema.parse(req.body);
  const lead = await Lead.findByIdAndUpdate(req.params.id, input, { new: true });
  if (!lead) throw AppError.notFound('Prospect introuvable');
  await audit(req, 'lead.update', 'Lead', lead._id, `${lead.name} : ${lead.status}`);
  sendOk(res, { updated: true });
});

// --- Clients ---------------------------------------------------------------------------

async function clientStats(filter: Record<string, unknown>) {
  // Filtre commun (organization ou client) appliqué à plusieurs collections.
  const f = <T>(extra: Record<string, unknown>) => ({ ...filter, ...extra }) as QueryFilter<T>;
  const [openTickets, quoteCount, invoices] = await Promise.all([
    Ticket.countDocuments(f<TicketDoc>({ status: OPEN_TICKETS })),
    Quote.countDocuments(f<QuoteDoc>({ status: trusted({ $ne: 'brouillon' }) })),
    Invoice.find(f<InvoiceDoc>({ paymentStatus: trusted({ $ne: 'annulee' }) }), {
      total: 1,
      payments: 1,
    }).lean(),
  ]);
  const invoicedTotal = invoices.reduce((s, i) => s + i.total, 0);
  const paid = invoices.reduce((s, i) => s + i.payments.reduce((p, x) => p + x.amount, 0), 0);
  return { openTickets, quoteCount, invoicedTotal, dueTotal: invoicedTotal - paid };
}

async function summarizeOrg(org: {
  _id: Types.ObjectId;
  name: string;
  type: string;
  email: string;
  phone: string;
  createdAt: Date;
}): Promise<ClientSummaryDto> {
  const filter = { organization: org._id };
  const [members, stats, sub] = await Promise.all([
    User.countDocuments(filter),
    clientStats(filter),
    activeSubscription({ organization: org._id }),
  ]);
  return {
    kind: 'organisation',
    id: String(org._id),
    name: org.name,
    profile: org.type,
    email: org.email,
    phone: org.phone,
    members,
    ...stats,
    subscription: sub?.plan.name ?? null,
    createdAt: org.createdAt.toISOString(),
  };
}

async function summarizeIndividual(u: {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profile?: string | null;
  createdAt: Date;
}): Promise<ClientSummaryDto> {
  const filter = { client: u._id, organization: null };
  const [stats, sub] = await Promise.all([
    clientStats(filter),
    activeSubscription({ client: u._id }),
  ]);
  return {
    kind: 'particulier',
    id: String(u._id),
    name: fullName(u),
    profile: u.profile ?? 'particulier',
    email: u.email,
    phone: u.phone,
    members: 1,
    ...stats,
    subscription: sub?.plan.name ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

backofficeRouter.get('/clients', async (req, res) => {
  const { page, limit, q, type } = clientListQuerySchema.parse(req.query);
  const orgFilter = q ? { $or: [{ name: rx(q) }, { email: rx(q) }] } : {};
  const userFilter = {
    role: 'client',
    organization: null,
    ...(q ? { $or: [{ firstName: rx(q) }, { lastName: rx(q) }, { email: rx(q) }] } : {}),
  };
  const [orgs, individuals] = await Promise.all([
    type === 'particulier' ? [] : Organization.find(orgFilter).lean(),
    type === 'organisation' ? [] : User.find(userFilter as QueryFilter<UserDoc>).lean(),
  ]);
  const rows = [
    ...orgs.map((o) => ({ kind: 'o' as const, doc: o, at: o.createdAt as Date })),
    ...individuals.map((u) => ({
      kind: 'u' as const,
      doc: u,
      at: (u as unknown as { createdAt: Date }).createdAt,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const slice = rows.slice((page - 1) * limit, page * limit);
  const items = await Promise.all(
    slice.map((r) =>
      r.kind === 'o'
        ? summarizeOrg(r.doc as Parameters<typeof summarizeOrg>[0])
        : summarizeIndividual(r.doc as Parameters<typeof summarizeIndividual>[0]),
    ),
  );
  sendOk(res, { items, page, limit, total: rows.length } satisfies Paginated<ClientSummaryDto>);
});

async function load360(kind: string, id: string): Promise<Client360Dto> {
  if (!ID.test(id) || !['organisation', 'particulier'].includes(kind))
    throw AppError.notFound('Client introuvable');
  let summary: ClientSummaryDto;
  let filter: Record<string, unknown>;
  let extra: Pick<Client360Dto, 'address' | 'taxId' | 'rccm' | 'notes' | 'contacts'>;
  if (kind === 'organisation') {
    const org = await Organization.findById(id).select('+notes').lean();
    if (!org) throw AppError.notFound('Client introuvable');
    summary = await summarizeOrg(org as Parameters<typeof summarizeOrg>[0]);
    filter = { organization: org._id };
    const members = await User.find({ organization: org._id }).lean();
    extra = {
      address: {
        street: org.address?.street ?? '',
        commune: org.address?.commune ?? '',
        city: org.address?.city ?? '',
      },
      taxId: org.taxId,
      rccm: org.rccm,
      notes: org.notes ?? '',
      contacts: members.map((m) => ({
        id: String(m._id),
        name: fullName(m),
        email: m.email,
        phone: m.phone,
        orgRole: m.orgRole ?? null,
        isActive: m.isActive,
      })),
    };
  } else {
    const user = await User.findOne({ _id: id, role: 'client' }).select('+adminNotes').lean();
    if (!user) throw AppError.notFound('Client introuvable');
    summary = await summarizeIndividual(user);
    filter = { client: user._id };
    extra = {
      address: { street: '', commune: '', city: '' },
      taxId: '',
      rccm: '',
      notes: (user as unknown as { adminNotes?: string }).adminNotes ?? '',
      contacts: [
        {
          id: String(user._id),
          name: fullName(user),
          email: user.email,
          phone: user.phone,
          orgRole: null,
          isActive: user.isActive,
        },
      ],
    };
  }
  const assetFilter = kind === 'organisation' ? { organization: id } : { owner: id };
  const [quotes, appointments, tickets, assets, invoices, subscription] = await Promise.all([
    Quote.find({ ...filter, status: trusted({ $ne: 'brouillon' }) })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Appointment.find(filter).sort({ start: -1 }).limit(50).populate('service', 'name').lean(),
    Ticket.find(filter).sort({ createdAt: -1 }).limit(50).lean(),
    Asset.find(assetFilter).select('+license.keyEncrypted').lean(),
    Invoice.find(filter).sort({ issuedAt: -1 }).limit(50).lean(),
    kind === 'organisation'
      ? activeSubscription({ organization: filter.organization as Types.ObjectId })
      : activeSubscription({ client: filter.client as Types.ObjectId }),
  ]);
  return {
    ...summary,
    ...extra,
    subscription360: subscription,
    quotes: quotes.map((q) => ({
      id: String(q._id),
      reference: q.reference ?? '',
      status: q.status,
      total: q.finalTotals?.total ?? null,
      createdAt: q.createdAt.toISOString(),
    })),
    appointments: appointments.map((a) => ({
      id: String(a._id),
      reference: a.reference,
      status: a.status,
      start: a.start.toISOString(),
      service: (a.service as unknown as { name: string } | null)?.name ?? null,
    })),
    tickets: tickets.map((t) => ({
      id: String(t._id),
      reference: t.reference,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
    })),
    assets: assets.map((a) => ({
      id: String(a._id),
      name: a.name,
      type: a.type,
      status: a.status,
      licenseExpiresAt: a.license?.expiresAt?.toISOString().slice(0, 10) ?? null,
      keyStored: Boolean(a.license?.keyEncrypted),
    })),
    invoices: invoices.map((i) => ({
      id: String(i._id),
      reference: i.reference,
      status: i.paymentStatus,
      total: i.total,
      paid: i.payments.reduce((s, p) => s + p.amount, 0),
      issuedAt: i.issuedAt.toISOString(),
    })),
  };
}

backofficeRouter.get('/clients/:kind/:id', async (req, res) => {
  sendOk(res, await load360(String(req.params.kind), String(req.params.id)));
});

backofficeRouter.patch('/clients/:kind/:id/notes', async (req, res) => {
  const { notes } = clientNotesSchema.parse(req.body);
  const { kind, id } = req.params;
  if (!ID.test(String(id))) throw AppError.notFound('Client introuvable');
  const updated =
    kind === 'organisation'
      ? await Organization.updateOne({ _id: id }, { notes })
      : await User.updateOne({ _id: id, role: 'client' }, { adminNotes: notes });
  if (!updated.matchedCount) throw AppError.notFound('Client introuvable');
  await audit(req, 'client.notes', kind === 'organisation' ? 'Organization' : 'User', String(id));
  sendOk(res, { updated: true });
});

backofficeRouter.put('/clients/:kind/:id/subscription', async (req, res) => {
  const { kind, id } = req.params;
  if (!ID.test(String(id))) throw AppError.notFound('Client introuvable');
  const input = subscriptionInputSchema.parse(req.body);
  const owner =
    kind === 'organisation'
      ? {
          organization: (await Organization.findById(id, { _id: 1 }).lean())?._id ?? null,
          client: null,
        }
      : {
          organization: null,
          client: (await User.findOne({ _id: id, role: 'client' }, { _id: 1 }).lean())?._id ?? null,
        };
  if (!owner.organization && !owner.client) throw AppError.notFound('Client introuvable');
  const sub = await saveSubscription(owner, input);
  await audit(
    req,
    'subscription.save',
    'Subscription',
    String(id),
    `${sub?.plan.name ?? 'formule'} · ${input.seats} postes · ${input.status}`,
  );
  sendOk(res, sub);
});

// --- Utilisateurs de l'équipe ---------------------------------------------------------------

/** Compte technicien ou admin : mot de passe aléatoire inutilisable, l'intéressé choisit le sien. */
backofficeRouter.post('/users', async (req, res) => {
  const input = adminCreateUserSchema.parse(req.body);
  if (await User.exists({ email: input.email })) {
    throw AppError.conflict('Un compte existe déjà avec cette adresse email', [
      { path: 'email', message: 'Adresse déjà utilisée' },
    ]);
  }
  const user = await User.create({
    ...input,
    passwordHash: await hashPassword(generateToken()),
    emailVerifiedAt: new Date(),
  });
  const token = await createOneTimeToken(user._id, 'password_reset', 7 * 24 * 3600_000);
  await sendTemplatedMail({
    to: user.email,
    subject: 'Votre accès à l’espace KODAV',
    greeting: `Bonjour ${user.firstName},`,
    paragraphs: [
      `Un compte ${input.role === 'admin' ? 'administrateur' : 'technicien'} vient d’être créé pour vous.`,
      'Choisissez votre mot de passe pour l’activer.',
    ],
    action: {
      label: 'Choisir mon mot de passe',
      url: `${env.CLIENT_URL}/reinitialiser-mot-de-passe?token=${token}`,
    },
    footnote: 'Ce lien est valable 7 jours.',
  });
  await audit(req, 'user.create', 'User', user._id, `${user.email} (${input.role})`);
  sendOk(res, { id: String(user._id) }, 201);
});

backofficeRouter.patch('/users/:id', async (req, res) => {
  if (!ID.test(String(req.params.id))) throw AppError.notFound('Utilisateur introuvable');
  const input = adminUpdateUserSchema.parse(req.body);
  if (
    String(req.params.id) === req.user!.id &&
    (input.isActive === false || (input.role && input.role !== 'admin'))
  ) {
    throw AppError.conflict('Vous ne pouvez pas retirer vos propres droits d’administration');
  }
  const user = await User.findById(req.params.id);
  if (!user) throw AppError.notFound('Utilisateur introuvable');
  const before = `${user.role}/${user.isActive ? 'actif' : 'inactif'}`;
  user.set(input);
  await user.save();
  if (input.isActive === false) {
    const { revokeUserSessions } = await import('../auth/auth.service.js');
    await revokeUserSessions(user._id);
  }
  await audit(
    req,
    'user.update',
    'User',
    user._id,
    `${user.email} : ${before} → ${user.role}/${user.isActive ? 'actif' : 'inactif'}`,
  );
  sendOk(res, { updated: true });
});

// --- Paramètres -------------------------------------------------------------------------------

backofficeRouter.get('/settings', async (_req, res) => {
  const doc = await Settings.findOne({ key: SETTINGS_KEY }).lean();
  sendOk(res, {
    brand: {
      ...defaultBrand,
      ...doc?.brand,
      social: { ...defaultBrand.social, ...doc?.brand?.social },
    },
    stats: (doc?.stats ?? []).map(({ label, value, suffix }) => ({
      label,
      value,
      suffix: suffix ?? '',
    })),
    quote: { validityDays: doc?.quote?.validityDays ?? 30 },
    invoice: {
      taxRate: doc?.invoice?.taxRate ?? 0,
      legalMentions: doc?.invoice?.legalMentions ?? '',
      bankDetails: doc?.invoice?.bankDetails ?? '',
    },
    emailTemplates: (doc?.emailTemplates ?? []) as AdminSettingsDto['emailTemplates'],
  } satisfies AdminSettingsDto);
});

backofficeRouter.put('/settings', async (req, res) => {
  const input = adminSettingsSchema.parse(req.body);
  // Téléphones : format international ivoirien, ou valeur d'attente du seed.
  for (const key of ['phone', 'whatsapp'] as const) {
    if (
      input.brand[key] &&
      !/^\+225\d{10}$/.test(input.brand[key]) &&
      !/X/.test(input.brand[key])
    ) {
      throw AppError.badRequest('Numéro au format +225 suivi de 10 chiffres', [
        { path: `brand.${key}`, message: 'Format +225XXXXXXXXXX' },
      ]);
    }
  }
  await Settings.updateOne({ key: SETTINGS_KEY }, { $set: input }, { upsert: true });
  await audit(
    req,
    'settings.update',
    'Settings',
    (await Settings.findOne({ key: SETTINGS_KEY }, { _id: 1 }).lean())!._id,
  );
  sendOk(res, input);
});

// --- Journal d'audit ---------------------------------------------------------------------------

backofficeRouter.get('/audit-logs', async (req, res) => {
  const { page, limit, entity } = auditListQuerySchema.parse(req.query);
  const filter = entity ? { entity } : {};
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'firstName lastName')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  sendOk(res, {
    items: items.map((l): AuditLogDto => {
      const actor = l.actor as unknown as {
        _id: Types.ObjectId;
        firstName: string;
        lastName: string;
      } | null;
      return {
        id: String(l._id),
        actor: actor ? { id: String(actor._id), name: fullName(actor) } : null,
        action: l.action,
        entity: l.entity,
        entityId: String(l.entityId),
        summary: l.summary ?? '',
        ip: l.ip ?? '',
        at: l.at.toISOString(),
      };
    }),
    page,
    limit,
    total,
  } satisfies Paginated<AuditLogDto>);
});

// --- Exports CSV -----------------------------------------------------------------------------

/** CSV pour Excel : séparateur « ; », BOM UTF-8, cellules échappées et protégées des formules. */
function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}
const d = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : '');

backofficeRouter.get('/export/:entity', async (req, res) => {
  const entity = String(req.params.entity).replace(/\.csv$/, '') as ExportEntity;
  if (!EXPORT_ENTITIES.includes(entity)) throw AppError.notFound('Export inconnu');
  let csv: string;
  switch (entity) {
    case 'devis': {
      const rows = await Quote.find({ status: trusted({ $ne: 'brouillon' }) })
        .sort({ createdAt: -1 })
        .lean();
      csv = toCsv(
        [
          'Référence',
          'Date',
          'Statut',
          'Client',
          'Entreprise',
          'Email',
          'Téléphone',
          'Estimation min',
          'Estimation max',
          'Total définitif',
        ],
        rows.map((q) => [
          q.reference,
          d(q.submittedAt),
          q.status,
          q.contact.name,
          q.contact.company,
          q.contact.email,
          q.contact.phone,
          q.estimate?.total.min,
          q.estimate?.total.max,
          q.finalTotals?.total,
        ]),
      );
      break;
    }
    case 'factures': {
      const rows = await Invoice.find().sort({ issuedAt: -1 }).lean();
      csv = toCsv(
        [
          'Référence',
          'Émise le',
          'Échéance',
          'Statut',
          'Client',
          'Entreprise',
          'Total HT',
          'TVA',
          'Total',
          'Réglé',
        ],
        rows.map((i) => [
          i.reference,
          d(i.issuedAt),
          d(i.dueAt),
          i.paymentStatus,
          i.billingSnapshot.name,
          i.billingSnapshot.company,
          i.total - i.taxAmount,
          i.taxAmount,
          i.total,
          i.payments.reduce((s, p) => s + p.amount, 0),
        ]),
      );
      break;
    }
    case 'prospects': {
      const rows = await Lead.find().sort({ createdAt: -1 }).lean();
      csv = toCsv(
        ['Date', 'Source', 'Statut', 'Nom', 'Entreprise', 'Email', 'Téléphone', 'Commune', 'Sujet'],
        rows.map((l) => [
          d((l as unknown as { createdAt: Date }).createdAt),
          l.source,
          l.status,
          l.name,
          l.company,
          l.email,
          l.phone,
          l.commune,
          l.subject,
        ]),
      );
      break;
    }
    case 'clients': {
      const [orgs, users] = await Promise.all([
        Organization.find().lean(),
        User.find({ role: 'client' }).lean(),
      ]);
      csv = toCsv(
        ['Type', 'Nom', 'Organisation', 'Email', 'Téléphone', 'Profil', 'Inscription'],
        [
          ...orgs.map((o) => [
            'Organisation',
            o.name,
            '',
            o.email,
            o.phone,
            o.type,
            d(o.createdAt as Date),
          ]),
          ...users.map((u) => [
            'Contact',
            fullName(u),
            orgs.find((o) => String(o._id) === String(u.organization))?.name ?? '',
            u.email,
            u.phone,
            u.profile,
            d(u.createdAt),
          ]),
        ],
      );
      break;
    }
    case 'tickets': {
      const rows = await Ticket.find()
        .sort({ createdAt: -1 })
        .populate('client', 'firstName lastName email')
        .lean();
      csv = toCsv(
        [
          'Référence',
          'Ouvert le',
          'Sujet',
          'Catégorie',
          'Priorité',
          'Statut',
          'Client',
          'Échéance',
          'Résolu le',
          'Note',
        ],
        rows.map((t) => {
          const c = t.client as unknown as { firstName: string; lastName: string } | null;
          return [
            t.reference,
            d(t.createdAt),
            t.subject,
            t.category,
            t.priority,
            t.status,
            c ? fullName(c) : '',
            d(t.slaDueAt),
            d(t.resolvedAt),
            t.satisfaction?.rating,
          ];
        }),
      );
      break;
    }
    case 'interventions': {
      const rows = await Appointment.find()
        .sort({ start: -1 })
        .populate('technician', 'firstName lastName')
        .lean();
      csv = toCsv(
        ['Référence', 'Date', 'Mode', 'Commune', 'Statut', 'Client', 'Téléphone', 'Technicien'],
        rows.map((a) => {
          const t = a.technician as unknown as { firstName: string; lastName: string } | null;
          return [
            a.reference,
            a.start.toISOString().slice(0, 16).replace('T', ' '),
            a.mode,
            a.address?.commune,
            a.status,
            a.contact.name,
            a.contact.phone,
            t ? fullName(t) : '',
          ];
        }),
      );
      break;
    }
  }
  await audit(req, 'export', 'Export', req.user!._id, entity);
  res
    .type('text/csv; charset=utf-8')
    .set('Content-Disposition', `attachment; filename="kodav-${entity}-${d(new Date())}.csv"`)
    .set('Cache-Control', 'no-store')
    .send(csv);
});

// --- Tableau de bord ------------------------------------------------------------------------

backofficeRouter.get('/dashboard', async (req, res) => {
  const period = Number(dashboardQuerySchema.parse(req.query).period);
  const now = new Date();
  const from = new Date(now.getTime() - period * 86_400_000);
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const since = trusted({ $gte: from });

  const [
    pendingQuotes,
    appointmentsToday,
    tickets,
    newLeads,
    invoices,
    decided,
    created,
    ticketsCreated,
  ] = await Promise.all([
    Quote.countDocuments({ status: trusted({ $in: ['soumis', 'en_revue'] }) }),
    Appointment.countDocuments({
      start: trusted({ $gte: dayStart, $lt: new Date(dayStart.getTime() + 86_400_000) }),
      status: trusted({ $ne: 'annulee' }),
    }),
    Ticket.aggregate<{ _id: string; n: number }>([
      { $match: { status: { $in: ['ouvert', 'en_cours', 'attente_client'] } } },
      { $group: { _id: '$priority', n: { $sum: 1 } } },
    ]),
    Lead.countDocuments({ status: 'nouveau' }),
    Invoice.find(
      { issuedAt: since, paymentStatus: trusted({ $ne: 'annulee' }) },
      { total: 1, issuedAt: 1, payments: 1 },
    ).lean(),
    Quote.find(
      { decidedAt: since, status: trusted({ $in: ['accepte', 'refuse'] }) },
      { status: 1, decidedAt: 1 },
    ).lean(),
    Quote.find({ submittedAt: since }, { submittedAt: 1 }).lean(),
    Ticket.find({ createdAt: since }, { createdAt: 1 }).lean(),
  ]);

  // Regroupement par jour (30 j), par semaine (90 j) ou par mois (365 j).
  const bucket = (date: Date) => {
    const iso = date.toISOString();
    if (period === 30) return iso.slice(0, 10);
    if (period === 365) return iso.slice(0, 7);
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return monday.toISOString().slice(0, 10);
  };
  const keys: string[] = [];
  for (let t = from.getTime(); t <= now.getTime(); t += 86_400_000) {
    const k = bucket(new Date(t));
    if (!keys.includes(k)) keys.push(k);
  }
  const series = new Map(
    keys.map((k) => [k, { date: k, quotes: 0, accepted: 0, invoiced: 0, tickets: 0 }]),
  );
  for (const q of created) if (q.submittedAt) series.get(bucket(q.submittedAt))!.quotes++;
  for (const q of decided) if (q.status === 'accepte') series.get(bucket(q.decidedAt!))!.accepted++;
  for (const i of invoices) series.get(bucket(i.issuedAt))!.invoiced += i.total;
  for (const t of ticketsCreated) series.get(bucket(t.createdAt))!.tickets++;

  const invoiced = invoices.reduce((s, i) => s + i.total, 0);
  const collected = invoices.reduce((s, i) => s + i.payments.reduce((p, x) => p + x.amount, 0), 0);
  const accepted = decided.filter((q) => q.status === 'accepte').length;
  const byPriority = Object.fromEntries(tickets.map((t) => [t._id, t.n]));
  sendOk(res, {
    period,
    kpis: {
      pendingQuotes,
      appointmentsToday,
      openTickets: {
        basse: byPriority.basse ?? 0,
        normale: byPriority.normale ?? 0,
        haute: byPriority.haute ?? 0,
        critique: byPriority.critique ?? 0,
      },
      newLeads,
      invoiced,
      collected,
      outstanding: invoiced - collected,
      acceptanceRate: decided.length ? Math.round((accepted / decided.length) * 100) : null,
    },
    series: [...series.values()],
  } satisfies DashboardDto);
});
