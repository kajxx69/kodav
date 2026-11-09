import type { Response } from 'express';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message = 'Requête invalide', details?: unknown) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Authentification requise') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'Accès refusé') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Ressource introuvable') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError(409, 'CONFLICT', message, details);
  }
}

/** Réponse de succès au format uniforme { success: true, data }. */
export function sendOk<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}
