import {
  USER_ROLES,
  adminUserListQuerySchema,
  type AdminOverview,
  type TicketPriority,
  type TicketStatus,
} from '@kodav/shared';
import { Router } from 'express';
import { trusted } from 'mongoose';
import { sendOk } from '../../lib/http.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { Service } from '../catalog/catalog.model.js';
import { Lead } from '../leads/lead.model.js';
import { Plan } from '../plans/plans.model.js';
import { Quote } from '../quotes/quote.model.js';
import { Ticket } from '../support/support.model.js';
import { User, toAuthUser } from '../users/user.model.js';

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('admin'));

/** Indicateurs disponibles dès la phase 2 ; le tableau de bord complet arrive en phase 6. */
adminRouter.get('/overview', async (_req, res) => {
  const open = trusted({ $in: ['ouvert', 'en_cours', 'attente_client'] as TicketStatus[] });
  const [
    byRole,
    newLeads,
    placeholderServices,
    placeholderPlans,
    pendingQuotes,
    total,
    urgent,
    overdue,
  ] = await Promise.all([
    User.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Lead.countDocuments({ status: 'nouveau' }),
    Service.countDocuments({ isPlaceholderPrice: true }),
    Plan.countDocuments({ isPlaceholderPrice: true }),
    Quote.countDocuments({ status: trusted({ $in: ['soumis', 'en_revue'] }) }),
    Ticket.countDocuments({ status: open }),
    Ticket.countDocuments({
      status: open,
      priority: trusted({ $in: ['haute', 'critique'] as TicketPriority[] }),
    }),
    Ticket.countDocuments({ status: open, slaDueAt: trusted({ $lt: new Date() }) }),
  ]);
  const users = Object.fromEntries(USER_ROLES.map((r) => [r, 0])) as AdminOverview['users'];
  for (const { _id, count } of byRole) users[_id as keyof typeof users] = count;
  sendOk(res, {
    users,
    newLeads,
    pendingQuotes,
    openTickets: { total, urgent, overdue },
    placeholderPrices: placeholderServices + placeholderPlans,
  } satisfies AdminOverview);
});

adminRouter.get('/users', async (req, res) => {
  const { page, limit, role, q } = adminUserListQuerySchema.parse(req.query);
  const filter = {
    ...(role ? { role } : {}),
    // Opérateur construit ici à partir d'une valeur validée : marqué sûr pour sanitizeFilter.
    ...(q ? { $text: trusted({ $search: q }) } : {}),
  };
  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('organization', 'name type')
      .lean(),
    User.countDocuments(filter),
  ]);
  sendOk(res, {
    items: items.map((u) => ({ ...toAuthUser(u), isActive: u.isActive })),
    page,
    limit,
    total,
  });
});
