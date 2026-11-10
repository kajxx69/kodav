import type { RequestHandler } from 'express';

/** Contenu public peu changeant : court cache navigateur/CDN, revalidé en arrière-plan. */
export const publicCache: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  next();
};
