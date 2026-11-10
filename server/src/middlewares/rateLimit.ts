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

/** Connexion, inscription, mot de passe oublié : 20 tentatives par quart d'heure et par IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(
      new AppError(429, 'TOO_MANY_REQUESTS', 'Trop de tentatives, réessayez dans quelques minutes'),
    );
  },
});

/** Estimation en direct du configurateur : appelée à chaque changement, plafond large. */
export const estimateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(new AppError(429, 'TOO_MANY_REQUESTS', 'Trop de calculs, patientez quelques secondes'));
  },
});
