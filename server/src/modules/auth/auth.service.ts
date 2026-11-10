import { randomUUID } from 'node:crypto';
import type { AuthSession } from '@kodav/shared';
import type { CookieOptions, Request, Response } from 'express';
import { trusted, type Types } from 'mongoose';
import { env, isProd } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { generateToken, hashToken } from '../../lib/crypto.js';
import { AppError } from '../../lib/http.js';
import { signAccessToken } from '../../middlewares/auth.js';
import { User, toAuthUser } from '../users/user.model.js';
import { AuthToken, type AuthTokenType } from './authToken.model.js';

export const REFRESH_COOKIE = 'kodav_rt';
const REFRESH_PATH = '/api/v1/auth';
/** Deux onglets qui rafraîchissent en même temps ne doivent pas être pris pour un vol. */
const REUSE_GRACE_MS = 15_000;

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: REFRESH_PATH,
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function clearRefreshCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
}

export function readRefreshCookie(req: Request): string | null {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function loadAuthUser(userId: Types.ObjectId | string) {
  const user = await User.findById(userId).populate('organization', 'name type').lean();
  if (!user) throw AppError.unauthorized();
  return toAuthUser(user);
}

/** Nouveau couple access token + refresh token (cookie) ; `family` conservée lors d'une rotation. */
export async function issueSession(
  res: Response,
  userId: Types.ObjectId,
  family: string = randomUUID(),
): Promise<AuthSession> {
  const user = await loadAuthUser(userId);
  const refreshToken = generateToken();
  await AuthToken.create({
    user: userId,
    type: 'refresh',
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return { accessToken: signAccessToken({ _id: userId, role: user.role }), user };
}

const sessionExpired = () =>
  new AppError(401, 'SESSION_EXPIRED', 'Session expirée, reconnectez-vous');

/** Rotation : le refresh token présenté est consommé et remplacé par un nouveau. */
export async function rotateSession(res: Response, refreshToken: string): Promise<AuthSession> {
  const now = new Date();
  const doc = await AuthToken.findOne({ tokenHash: hashToken(refreshToken), type: 'refresh' });
  if (!doc || doc.revokedAt || doc.expiresAt <= now) throw sessionExpired();

  if (doc.usedAt && now.getTime() - doc.usedAt.getTime() > REUSE_GRACE_MS) {
    // Jeton déjà échangé puis représenté : probable vol, toute la famille est révoquée.
    await AuthToken.updateMany({ family: doc.family }, { revokedAt: now });
    logger.warn(
      { userId: String(doc.user) },
      'Réutilisation d’un refresh token : sessions révoquées',
    );
    throw sessionExpired();
  }
  if (!doc.usedAt) await AuthToken.updateOne({ _id: doc._id, usedAt: null }, { usedAt: now });

  const user = await User.findById(doc.user, { isActive: 1 }).lean();
  if (!user?.isActive) {
    await revokeUserSessions(doc.user);
    throw sessionExpired();
  }
  return issueSession(res, doc.user, doc.family ?? undefined);
}

export async function revokeSessionFamily(refreshToken: string) {
  const doc = await AuthToken.findOne(
    { tokenHash: hashToken(refreshToken), type: 'refresh' },
    { family: 1 },
  ).lean();
  if (doc?.family) await AuthToken.updateMany({ family: doc.family }, { revokedAt: new Date() });
}

export async function revokeUserSessions(userId: Types.ObjectId) {
  await AuthToken.updateMany(
    { user: userId, type: 'refresh', revokedAt: null },
    { revokedAt: new Date() },
  );
}

/** Jeton à usage unique envoyé par email ; un nouveau jeton annule les précédents du même type. */
export async function createOneTimeToken(
  userId: Types.ObjectId,
  type: Exclude<AuthTokenType, 'refresh'>,
  ttlMs: number,
) {
  await AuthToken.deleteMany({ user: userId, type });
  const token = generateToken();
  await AuthToken.create({
    user: userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

/** Consommation atomique : un même lien ne peut servir qu'une fois, avant expiration. */
export async function consumeOneTimeToken(token: string, type: Exclude<AuthTokenType, 'refresh'>) {
  const now = new Date();
  const doc = await AuthToken.findOneAndUpdate(
    {
      tokenHash: hashToken(token),
      type,
      usedAt: null,
      expiresAt: trusted({ $gt: now }),
    },
    { usedAt: now },
  ).lean();
  if (!doc) {
    throw new AppError(400, 'INVALID_TOKEN', 'Ce lien est invalide ou a expiré');
  }
  return doc.user;
}
