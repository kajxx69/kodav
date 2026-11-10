import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../lib/http.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Vérifie le jeton Cloudflare Turnstile (champ `turnstileToken`) quand TURNSTILE_ENABLED=true. */
export const verifyTurnstile: RequestHandler = async (req, _res, next) => {
  if (!env.TURNSTILE_ENABLED) return next();
  const token: unknown = req.body?.turnstileToken;
  if (typeof token !== 'string' || !token) {
    return next(AppError.badRequest('Vérification anti-robot manquante'));
  }
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY!,
        response: token,
        ...(req.ip ? { remoteip: req.ip } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as { success: boolean };
    if (!result.success) return next(AppError.badRequest('Vérification anti-robot échouée'));
    next();
  } catch (err) {
    logger.warn({ err }, 'Turnstile injoignable');
    next(new AppError(503, 'TURNSTILE_UNAVAILABLE', 'Vérification anti-robot indisponible'));
  }
};
