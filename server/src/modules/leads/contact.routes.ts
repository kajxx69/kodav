import { Router } from 'express';
import { contactInputSchema } from '@kodav/shared';
import { logger } from '../../config/logger.js';
import { sendOk } from '../../lib/http.js';
import { publicFormLimiter } from '../../middlewares/rateLimit.js';
import { verifyTurnstile } from '../../middlewares/turnstile.js';
import { notifyAdmins } from '../notifications/notification.service.js';
import { Lead } from './lead.model.js';

export const contactRouter = Router();

contactRouter.post('/', publicFormLimiter, verifyTurnstile, async (req, res) => {
  const { website, consent: _consent, ...input } = contactInputSchema.parse(req.body);
  // Pot de miel rempli : on répond comme si tout allait bien, sans rien enregistrer.
  if (website) {
    sendOk(res, { received: true }, 201);
    return;
  }
  const lead = await Lead.create({
    ...input,
    source: 'contact',
    consentAt: new Date(),
    ip: req.ip,
  });
  logger.info({ leadId: lead.id }, 'Nouveau message de contact');
  await notifyAdmins({
    type: 'lead_new',
    title: 'Nouveau message de contact',
    body: `${input.name} · ${input.subject}`,
    link: '/admin/prospects',
  });
  sendOk(res, { received: true }, 201);
});
