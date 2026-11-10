import type { Request } from 'express';
import type { Types } from 'mongoose';
import { logger } from '../config/logger.js';
import { AuditLog } from '../modules/support/support.model.js';

/** Journal des actions de l'équipe : qui, quoi, quand, depuis où. Jamais bloquant. */
export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId: Types.ObjectId | string,
  summary = '',
) {
  try {
    await AuditLog.create({
      actor: req.user!._id,
      action,
      entity,
      entityId,
      summary: summary.slice(0, 500),
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 200),
    });
  } catch (err) {
    logger.error({ err, action }, 'Journal d’audit');
  }
}
