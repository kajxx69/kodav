import { rateLimit } from 'express-rate-limit';
import { isTest } from '../config/env.js';
import { AppError } from '../lib/http.js';

/** Formulaires publics (contact, diagnostic, bilan) : 10 envois par quart d'heure et par IP. */
export const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(
      new AppError(429, 'TOO_MANY_REQUESTS', 'Trop de demandes, réessayez dans quelques minutes'),
    );
  },
});
