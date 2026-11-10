import {
  MAX_ATTACHMENTS,
  adminTicketUpdateSchema,
  createTicketSchema,
  rateTicketSchema,
  ticketListQuerySchema,
  ticketMessageSchema,
  type TicketStatus,
} from '@kodav/shared';
import { Router, type Request } from 'express';
import multer from 'multer';
import { trusted, type QueryFilter } from 'mongoose';
import { nextReference } from '../../lib/counter.js';
import { AppError, sendOk } from '../../lib/http.js';
import { MAX_UPLOAD_BYTES, assertAttachment, readFile, saveFile } from '../../lib/storage.js';
import { authenticate, requireRole, type RequestUser } from '../../middlewares/auth.js';
import { publicFormLimiter } from '../../middlewares/rateLimit.js';
import { User } from '../users/user.model.js';
import {
  Asset,
  Ticket,
  TicketMessage,
  pushTicketStatus,
  type TicketDoc,
  type TicketDocument,
} from './support.model.js';
import {
  broadcastMessage,
  broadcastTicket,
  findTicket,
  inBackground,
  listTickets,
  loadTicketDetail,
  notifyMessage,
  notifyNewTicket,
  notifyStatusChange,
  slaFor,
  toMessageDto,
} from './ticket.service.js';

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_ATTACHMENTS },
});

/** Pièces jointes vérifiées (type réel) puis enregistrées sous un nom aléatoire. */
async function saveAttachments(req: Request) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const mimes = await Promise.all(files.map((f) => assertAttachment(f.buffer)));
  const saved = [];
  for (const [i, f] of files.entries()) {
    saved.push({
      publicId: await saveFile(f.buffer, 'tickets'),
      // Nom d'origine conservé pour l'affichage seulement, nettoyé.
      name: f.originalname.replace(/[^\w.\- ()À-ÿ]/g, '_').slice(0, 120) || 'piece-jointe',
      mime: mimes[i]!,
      size: f.size,
    });
  }
  return saved;
}

/** Texte brut uniquement : toute balise HTML est retirée (aucun risque d'injection). */
const plainText = (body: string) => body.replace(/<[^>]*>/g, '').trim();

async function postMessage(ticket: TicketDocument, user: RequestUser, req: Request) {
  const { body, isInternal } = ticketMessageSchema.parse(req.body);
  const staff = user.role !== 'client';
  if (isInternal && !staff) throw AppError.forbidden('Notes internes réservées à l’équipe');
  if (ticket.status === 'ferme') {
    throw AppError.conflict('Ce ticket est fermé : ouvrez une nouvelle demande');
  }
  const text = plainText(body);
  if (!text) throw AppError.badRequest('Écrivez votre message');

  const message = await TicketMessage.create({
    ticket: ticket._id,
    author: user._id,
    body: text,
    attachments: await saveAttachments(req),
    isInternal,
    readBy: [user._id],
  });

  // Effets sur le ticket : réponse publique de l'équipe ou relance du client.
  let statusChanged = false;
  if (!isInternal) {
    ticket.lastMessageAt = message.createdAt;
    if (staff) {
      ticket.firstResponseAt ??= message.createdAt;
      if (ticket.status === 'ouvert')
        statusChanged = pushTicketStatus(ticket, 'en_cours', user._id);
    } else if (['attente_client', 'resolu'].includes(ticket.status)) {
      statusChanged = pushTicketStatus(ticket, 'en_cours', user._id);
    }
  }
  await ticket.save();

  const author = await User.findById(user._id, { firstName: 1, lastName: 1, role: 1 }).lean();
  const dto = toMessageDto({
    ...message.toObject(),
    author: author as unknown as Parameters<typeof toMessageDto>[0]['author'],
  });
  broadcastMessage(ticket, dto);
  if (statusChanged) broadcastTicket(ticket);
  inBackground(notifyMessage(ticket, dto, staff), 'Notification de message');
  return dto;
}

// --- Client -------------------------------------------------------------------

export const ticketsRouter = Router();
ticketsRouter.use(authenticate);

ticketsRouter.post(
  '/',
  requireRole('client'),
  publicFormLimiter,
  attachmentUpload.array('attachments', MAX_ATTACHMENTS),
  async (req, res) => {
    const input = createTicketSchema.parse(req.body);
    const user = req.user!;
    if (input.assetId) {
      const owned = await Asset.exists({
        _id: input.assetId,
        ...(user.organization ? { organization: user.organization } : { owner: user._id }),
      });
      if (!owned) throw AppError.badRequest('Équipement introuvable dans votre parc');
    }
    const now = new Date();
    const sla = await slaFor(input.priority, now, {
      organization: user.organization,
      client: user._id,
    });
    const ticket = new Ticket({
      reference: await nextReference('TCK', now),
      client: user._id,
      organization: user.organization,
      subject: plainText(input.subject),
      category: input.category,
      priority: input.priority,
      asset: input.assetId ?? null,
      statusHistory: [{ status: 'ouvert', at: now, by: user._id }],
      slaHours: sla.hours,
      slaDueAt: sla.dueAt,
      lastMessageAt: now,
    });
    await ticket.save();
    try {
      await postMessage(ticket, user, { ...req, body: { body: input.body } } as Request);
    } catch (err) {
      await Ticket.deleteOne({ _id: ticket._id });
      throw err;
    }
    inBackground(notifyNewTicket(ticket), 'Notification de nouveau ticket');
    broadcastTicket(ticket);
    sendOk(res, await loadTicketDetail(ticket._id, user), 201);
  },
);

function listFilter(query: ReturnType<typeof ticketListQuerySchema.parse>, user: RequestUser) {
  const filter: QueryFilter<TicketDoc> = {};
  if (query.status) filter.status = query.status;
  else if (query.open === 'true')
    filter.status = trusted({ $in: ['ouvert', 'en_cours', 'attente_client'] });
  if (query.priority) filter.priority = query.priority;
  if (query.assignee === 'me') filter.assignee = user._id;
  else if (query.assignee === 'none') filter.assignee = null;
  else if (query.assignee) filter.assignee = query.assignee as unknown as TicketDoc['assignee'];
  if (query.q) {
    const rx = trusted({ $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' });
    filter.$or = [{ reference: rx }, { subject: rx }];
  }
  return filter;
}

ticketsRouter.get('/', async (req, res) => {
  const query = ticketListQuerySchema.parse(req.query);
  const { items, total } = await listTickets(
    listFilter(query, req.user!),
    req.user!,
    query.limit,
    (query.page - 1) * query.limit,
  );
  sendOk(res, { items, total, page: query.page, limit: query.limit });
});

ticketsRouter.get('/:id', async (req, res) => {
  const ticket = await findTicket(req.params.id, req.user!);
  sendOk(res, await loadTicketDetail(ticket._id, req.user!));
});

ticketsRouter.post(
  '/:id/messages',
  publicFormLimiter,
  attachmentUpload.array('attachments', MAX_ATTACHMENTS),
  async (req, res) => {
    const ticket = await findTicket(req.params.id, req.user!);
    sendOk(res, await postMessage(ticket, req.user!, req), 201);
  },
);

ticketsRouter.get('/:id/messages/:messageId/attachments/:index', async (req, res) => {
  const ticket = await findTicket(req.params.id, req.user!);
  const message = /^[a-f\d]{24}$/i.test(String(req.params.messageId))
    ? await TicketMessage.findOne({ _id: req.params.messageId, ticket: ticket._id }).lean()
    : null;
  if (!message || (message.isInternal && req.user!.role === 'client')) {
    throw AppError.notFound('Pièce jointe introuvable');
  }
  const file = message.attachments[Number(req.params.index)];
  if (!file) throw AppError.notFound('Pièce jointe introuvable');
  res
    .type(file.mime)
    .set('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`)
    .set('Cache-Control', 'private, max-age=3600')
    .send(await readFile(file.publicId));
});

/** Le client signale que son problème est réglé. */
ticketsRouter.post('/:id/resolve', requireRole('client'), async (req, res) => {
  const ticket = await findTicket(req.params.id, req.user!);
  if (!['ouvert', 'en_cours', 'attente_client'].includes(ticket.status)) {
    throw AppError.conflict('Ce ticket est déjà résolu');
  }
  pushTicketStatus(ticket, 'resolu', req.user!._id);
  await ticket.save();
  broadcastTicket(ticket);
  sendOk(res, await loadTicketDetail(ticket._id, req.user!));
});

ticketsRouter.post('/:id/rate', requireRole('client'), async (req, res) => {
  const { rating, comment } = rateTicketSchema.parse(req.body);
  const ticket = await findTicket(req.params.id, req.user!);
  if (ticket.status !== 'resolu')
    throw AppError.conflict('Vous pourrez noter une fois le ticket résolu');
  ticket.satisfaction = { rating, comment, at: new Date() };
  pushTicketStatus(ticket, 'ferme', req.user!._id);
  await ticket.save();
  broadcastTicket(ticket);
  sendOk(res, await loadTicketDetail(ticket._id, req.user!));
});

// --- Équipe (admin, technicien) ------------------------------------------------------

export const staffTicketsRouter = Router();
staffTicketsRouter.use(authenticate, requireRole('admin', 'technicien'));

/** Passages de statut autorisés à l'équipe (fermeture : par la note du client ou l'admin). */
const STAFF_STATUSES: TicketStatus[] = ['en_cours', 'attente_client', 'resolu'];

staffTicketsRouter.patch('/:id', async (req, res) => {
  const input = adminTicketUpdateSchema.parse(req.body);
  const user = req.user!;
  const ticket = await findTicket(req.params.id, user);
  const isAdmin = user.role === 'admin';

  if (input.assignee !== undefined) {
    if (!isAdmin) throw AppError.forbidden('Seul un administrateur peut réassigner');
    if (input.assignee) {
      const ok = await User.exists({
        _id: input.assignee,
        role: trusted({ $in: ['technicien', 'admin'] }),
        isActive: true,
      });
      if (!ok) throw AppError.badRequest('Membre de l’équipe introuvable');
    }
    ticket.assignee = (input.assignee ?? null) as TicketDoc['assignee'];
  }
  if (input.priority && input.priority !== ticket.priority) {
    if (!isAdmin) throw AppError.forbidden('Seul un administrateur peut changer la priorité');
    const sla = await slaFor(input.priority, ticket.createdAt, {
      organization: ticket.organization,
      client: ticket.client,
    });
    ticket.priority = input.priority;
    ticket.slaHours = sla.hours;
    ticket.slaDueAt = sla.dueAt;
  }
  let statusChanged = false;
  if (input.status) {
    if (!isAdmin && !STAFF_STATUSES.includes(input.status)) {
      throw AppError.forbidden('Changement de statut réservé à un administrateur');
    }
    if (ticket.status === 'ferme' && !isAdmin) throw AppError.conflict('Ce ticket est fermé');
    statusChanged = pushTicketStatus(ticket, input.status, user._id);
  }
  await ticket.save();
  broadcastTicket(ticket);
  if (statusChanged) inBackground(notifyStatusChange(ticket), 'Notification de statut de ticket');
  if (input.assignee) {
    inBackground(
      import('../notifications/notification.service.js').then(({ notify }) =>
        notify([input.assignee], {
          type: 'ticket_new',
          title: `Ticket ${ticket.reference} assigné`,
          body: ticket.subject,
          link: `/technicien/tickets/${String(ticket._id)}`,
        }),
      ),
      'Notification d’affectation',
    );
  }
  sendOk(res, await loadTicketDetail(ticket._id, user));
});

staffTicketsRouter.get('/team', requireRole('admin'), async (_req, res) => {
  const team = await User.find(
    { role: trusted({ $in: ['technicien', 'admin'] }), isActive: true },
    { firstName: 1, lastName: 1, role: 1 },
  )
    .sort({ role: -1, firstName: 1 })
    .lean();
  sendOk(
    res,
    team.map((u) => ({ id: String(u._id), name: `${u.firstName} ${u.lastName}`, role: u.role })),
  );
});
