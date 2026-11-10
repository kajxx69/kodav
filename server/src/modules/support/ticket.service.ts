import {
  DEFAULT_SLA_HOURS,
  type AssetType,
  TICKET_STATUS_LABELS,
  type TicketDetailDto,
  type TicketDto,
  type TicketMessageDto,
  type TicketPriority,
  type UserRole,
} from '@kodav/shared';
import { trusted, type QueryFilter, type Types } from 'mongoose';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { addBusinessHours } from '../../lib/businessHours.js';
import { AppError } from '../../lib/http.js';
import { sendTemplatedMail } from '../../lib/mailer.js';
import { emitTo } from '../../lib/socket.js';
import type { RequestUser } from '../../middlewares/auth.js';
import { getAvailability } from '../appointments/appointment.service.js';
import { notify } from '../notifications/notification.service.js';
import { User } from '../users/user.model.js';
import {
  Ticket,
  TicketMessage,
  type TicketDoc,
  type TicketDocument,
  type TicketMessageDoc,
} from './support.model.js';

type Lean<T> = T & { _id: Types.ObjectId };

export function inBackground(task: Promise<unknown>, what: string) {
  task.catch((err: unknown) => logger.error({ err }, what));
}

/** Échéance du ticket : heures ouvrées selon la priorité (formule souscrite plus tard). */
export async function slaFor(priority: TicketPriority, from: Date) {
  const hours = DEFAULT_SLA_HOURS[priority];
  return { hours, dueAt: addBusinessHours(from, hours, await getAvailability()) };
}

/** Filtre de visibilité d'un ticket selon le rôle. */
export function ticketScope(user: RequestUser): QueryFilter<TicketDoc> {
  if (user.role === 'admin') return {};
  if (user.role === 'technicien') return { assignee: user._id };
  const or: QueryFilter<TicketDoc>[] = [{ client: user._id }];
  if (user.organization) or.push({ organization: user.organization });
  return { $or: or };
}

export async function findTicket(id: unknown, user: RequestUser) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throw AppError.notFound('Ticket introuvable');
  }
  const ticket = await Ticket.findOne({ _id: id, ...ticketScope(user) });
  if (!ticket) throw AppError.notFound('Ticket introuvable');
  return ticket;
}

/** Accès temps réel : « staff » voit les notes internes. */
export async function ticketSocketAccess(userId: string, role: UserRole, id: string) {
  const user = await User.findById(userId, { role: 1, organization: 1 }).lean();
  if (!user) return null;
  const scope = ticketScope({
    id: userId,
    _id: user._id,
    role,
    organization: user.organization ?? null,
    orgRole: null,
    emailVerified: true,
  });
  const found = await Ticket.exists({ _id: id, ...scope });
  if (!found) return null;
  return role === 'client' ? 'client' : 'staff';
}

const fullName = (u: { firstName: string; lastName: string } | null | undefined) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : '';

type Populated = Lean<TicketDoc> & {
  client: Lean<{ firstName: string; lastName: string; email: string }> | Types.ObjectId;
  organization: Lean<{ name: string }> | Types.ObjectId | null;
  asset: Lean<{ name: string; type: string }> | Types.ObjectId | null;
  assignee: Lean<{ firstName: string; lastName: string }> | Types.ObjectId | null;
};

const POPULATE = [
  { path: 'client', select: 'firstName lastName email' },
  { path: 'organization', select: 'name' },
  { path: 'asset', select: 'name type' },
  { path: 'assignee', select: 'firstName lastName' },
];

const pick = <T extends object>(v: unknown, key: string): T | null =>
  v && typeof v === 'object' && key in v ? (v as T) : null;

function toTicketDto(t: Populated, unread: number): TicketDto {
  const client = pick<Lean<{ firstName: string; lastName: string; email: string }>>(
    t.client,
    'email',
  );
  const org = pick<Lean<{ name: string }>>(t.organization, 'name');
  const asset = pick<Lean<{ name: string; type: AssetType }>>(t.asset, 'name');
  const assignee = pick<Lean<{ firstName: string; lastName: string }>>(t.assignee, 'firstName');
  return {
    id: String(t._id),
    reference: t.reference,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    statusHistory: t.statusHistory.map((h) => ({ status: h.status, at: h.at.toISOString() })),
    client: client
      ? {
          id: String(client._id),
          name: fullName(client),
          email: client.email,
          organization: org?.name ?? null,
        }
      : null,
    asset: asset ? { id: String(asset._id), name: asset.name, type: asset.type } : null,
    assignee: assignee ? { id: String(assignee._id), name: fullName(assignee) } : null,
    slaDueAt: t.slaDueAt.toISOString(),
    slaHours: t.slaHours,
    firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    satisfaction: t.satisfaction
      ? {
          rating: t.satisfaction.rating,
          comment: t.satisfaction.comment,
          at: t.satisfaction.at.toISOString(),
        }
      : null,
    lastMessageAt: t.lastMessageAt.toISOString(),
    unread,
    createdAt: t.createdAt.toISOString(),
  };
}

/** Messages non lus par l'utilisateur, ticket par ticket (notes internes exclues côté client). */
async function unreadCounts(ticketIds: Types.ObjectId[], user: RequestUser) {
  if (!ticketIds.length) return new Map<string, number>();
  const rows = await TicketMessage.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        ticket: { $in: ticketIds },
        author: { $ne: user._id },
        readBy: { $ne: user._id },
        ...(user.role === 'client' ? { isInternal: false } : {}),
      },
    },
    { $group: { _id: '$ticket', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function listTickets(
  filter: QueryFilter<TicketDoc>,
  user: RequestUser,
  limit = 50,
  skip = 0,
) {
  const [items, total] = await Promise.all([
    Ticket.find({ ...filter, ...ticketScope(user) })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(POPULATE)
      .lean<Populated[]>(),
    Ticket.countDocuments({ ...filter, ...ticketScope(user) }),
  ]);
  const unread = await unreadCounts(
    items.map((t) => t._id),
    user,
  );
  return { items: items.map((t) => toTicketDto(t, unread.get(String(t._id)) ?? 0)), total };
}

type AuthorDoc = Lean<{ firstName: string; lastName: string; role: UserRole }>;

export function toMessageDto(
  m: Lean<TicketMessageDoc> & { author: AuthorDoc | Types.ObjectId },
): TicketMessageDto {
  const author = pick<AuthorDoc>(m.author, 'role');
  return {
    id: String(m._id),
    author: {
      id: author ? String(author._id) : String(m.author),
      name: author ? fullName(author) : '',
      role: author?.role ?? 'client',
    },
    body: m.body,
    isInternal: m.isInternal,
    attachments: m.attachments.map((a, i) => ({
      id: String(i),
      name: a.name,
      mime: a.mime,
      size: a.size,
    })),
    createdAt: m.createdAt.toISOString(),
  };
}

/** Détail du ticket ; les messages affichés sont marqués lus pour l'utilisateur. */
export async function loadTicketDetail(
  id: Types.ObjectId,
  user: RequestUser,
): Promise<TicketDetailDto> {
  const visible = { ticket: id, ...(user.role === 'client' ? { isInternal: false } : {}) };
  await TicketMessage.updateMany(
    { ...visible, readBy: trusted({ $ne: user._id }) },
    { $addToSet: { readBy: user._id } },
  );
  const [ticket, messages] = await Promise.all([
    Ticket.findById(id).populate(POPULATE).lean<Populated>(),
    TicketMessage.find(visible)
      .sort({ createdAt: 1 })
      .populate('author', 'firstName lastName role')
      .lean(),
  ]);
  if (!ticket) throw AppError.notFound('Ticket introuvable');
  return {
    ...toTicketDto(ticket, 0),
    messages: messages.map((m) => toMessageDto(m as Parameters<typeof toMessageDto>[0])),
  };
}

// --- Diffusion et notifications -------------------------------------------------

export function broadcastTicket(ticket: TicketDocument) {
  emitTo(
    [`ticket:${String(ticket._id)}`, 'staff', `user:${String(ticket.client)}`],
    'ticket:updated',
    {
      id: String(ticket._id),
      status: ticket.status,
      priority: ticket.priority,
      assignee: ticket.assignee ? String(ticket.assignee) : null,
    },
  );
}

export function broadcastMessage(ticket: TicketDocument, message: TicketMessageDto) {
  const rooms = message.isInternal
    ? [`ticket:${String(ticket._id)}:staff`]
    : [`ticket:${String(ticket._id)}`];
  emitTo(rooms, 'ticket:message', { ticketId: String(ticket._id), message });
}

const clientLink = (t: Pick<TicketDoc, 'reference'> & { _id: Types.ObjectId }) =>
  `/espace-client/tickets/${String(t._id)}`;
const staffLink = (t: { _id: Types.ObjectId }) => `/admin/tickets/${String(t._id)}`;

async function staffRecipients(ticket: TicketDocument) {
  if (ticket.assignee) return [ticket.assignee];
  return (await User.find({ role: 'admin', isActive: true }, { _id: 1 }).lean()).map((u) => u._id);
}

/** Nouveau message : prévient « l'autre côté » (notification et, pour le client, email). */
export async function notifyMessage(
  ticket: TicketDocument,
  message: TicketMessageDto,
  fromStaff: boolean,
) {
  if (message.isInternal) return;
  if (fromStaff) {
    await notify([ticket.client], {
      type: 'ticket_message',
      title: `Nouvelle réponse sur ${ticket.reference}`,
      body: message.body.slice(0, 140),
      link: clientLink(ticket),
    });
    const client = await User.findById(ticket.client, {
      email: 1,
      firstName: 1,
      notificationPrefs: 1,
    }).lean();
    if (client && client.notificationPrefs?.email !== false) {
      await sendTemplatedMail({
        to: client.email,
        subject: `Réponse à votre demande ${ticket.reference}`,
        greeting: `Bonjour ${client.firstName},`,
        paragraphs: [
          `${message.author.name} a répondu à votre demande « ${ticket.subject} » :`,
          message.body,
        ],
        action: { label: 'Voir la conversation', url: `${env.CLIENT_URL}${clientLink(ticket)}` },
      });
    }
  } else {
    const staff = await staffRecipients(ticket);
    const technicianLink = `/technicien/tickets/${String(ticket._id)}`;
    for (const id of staff) {
      const u = await User.findById(id, { role: 1 }).lean();
      await notify([id], {
        type: 'ticket_message',
        title: `${ticket.reference} : nouveau message du client`,
        body: message.body.slice(0, 140),
        link: u?.role === 'technicien' ? technicianLink : staffLink(ticket),
      });
    }
  }
}

export async function notifyNewTicket(ticket: TicketDocument) {
  const admins = await User.find({ role: 'admin', isActive: true }, { _id: 1 }).lean();
  await notify(
    admins.map((a) => a._id),
    {
      type: 'ticket_new',
      title: `Nouveau ticket ${ticket.reference} (${ticket.priority})`,
      body: ticket.subject,
      link: staffLink(ticket),
    },
  );
}

export async function notifyStatusChange(ticket: TicketDocument) {
  await notify([ticket.client], {
    type: 'ticket_status',
    title: `${ticket.reference} : ${TICKET_STATUS_LABELS[ticket.status].toLowerCase()}`,
    body: ticket.subject,
    link: clientLink(ticket),
  });
  if (ticket.status === 'resolu') {
    const client = await User.findById(ticket.client, {
      email: 1,
      firstName: 1,
      notificationPrefs: 1,
    }).lean();
    if (client && client.notificationPrefs?.email !== false) {
      await sendTemplatedMail({
        to: client.email,
        subject: `Demande ${ticket.reference} résolue`,
        greeting: `Bonjour ${client.firstName},`,
        paragraphs: [
          `Nous avons résolu votre demande « ${ticket.subject} ».`,
          'Votre avis compte : notez notre intervention en un clic. Si le problème persiste, répondez simplement dans la conversation.',
        ],
        action: { label: 'Donner mon avis', url: `${env.CLIENT_URL}${clientLink(ticket)}` },
      });
    }
  }
}

/** Fermeture automatique des tickets résolus sans retour depuis 7 jours. */
export async function closeStaleTickets(now = new Date()) {
  const stale = await Ticket.find({
    status: 'resolu',
    resolvedAt: trusted({ $lte: new Date(now.getTime() - 7 * 24 * 3600_000) }),
  });
  for (const t of stale) {
    t.status = 'ferme';
    t.statusHistory.push({ status: 'ferme', at: now, by: null });
    await t.save();
  }
  return stale.length;
}
