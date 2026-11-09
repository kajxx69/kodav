import type { RequestHandler } from 'express';

/**
 * Équivalent d'express-mongo-sanitize compatible Express 5 :
 * supprime récursivement les clés commençant par « $ » ou contenant « . »
 * dans body, params et query. Express 5 expose req.query via un getter
 * recalculé à chaque accès : on le remplace par la version nettoyée.
 */
const FORBIDDEN_KEY = /^\$|\./;

export function sanitizeValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sanitizeValue) as T;
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    const clean: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (!FORBIDDEN_KEY.test(key)) clean[key] = sanitizeValue(inner);
    }
    return clean as T;
  }
  return value;
}

export const mongoSanitize: RequestHandler = (req, _res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.params) req.params = sanitizeValue(req.params);
  Object.defineProperty(req, 'query', {
    value: sanitizeValue(req.query),
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
};
