import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { AppError } from '../lib/http.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route introuvable : ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Certaines données sont invalides',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Erreurs de body-parser (JSON mal formé, corps trop volumineux…)
  const status: number = typeof err?.status === 'number' ? err.status : 500;
  if (status >= 400 && status < 500) {
    res.status(status).json({
      success: false,
      error: {
        code: err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        message: 'Requête invalide',
      },
    });
    return;
  }

  logger.error({ err, method: req.method, url: req.originalUrl }, 'Erreur non gérée');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Une erreur interne est survenue' },
  });
};
