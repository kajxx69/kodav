import type { UserRole } from '@kodav/shared';
import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../lib/http.js';
import { User } from '../modules/users/user.model.js';

export type RequestUser = {
  id: string;
  _id: Types.ObjectId;
  role: UserRole;
  organization: Types.ObjectId | null;
  orgRole: 'owner' | 'member' | null;
  emailVerified: boolean;
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: RequestUser;
  }
}

type AccessPayload = { sub: string; role: UserRole; iat: number };

export function signAccessToken(user: { _id: Types.ObjectId; role: UserRole }) {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: String(user._id),
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

/**
 * Vérifie le jeton d'accès puis recharge l'utilisateur : un compte désactivé ou dont
 * le mot de passe a changé depuis l'émission du jeton est refusé immédiatement.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw AppError.unauthorized();

  let payload: AccessPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    }) as AccessPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Session expirée');
    }
    throw AppError.unauthorized();
  }

  const user = await User.findById(payload.sub, {
    role: 1,
    organization: 1,
    orgRole: 1,
    isActive: 1,
    emailVerifiedAt: 1,
    passwordChangedAt: 1,
  }).lean();
  if (!user || !user.isActive) throw AppError.unauthorized();
  // `iat` est en secondes : un jeton émis dans la même seconde que le changement reste valide.
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Session expirée');
  }

  req.user = {
    id: String(user._id),
    _id: user._id,
    role: user.role,
    organization: user.organization ?? null,
    orgRole: user.orgRole ?? null,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
  next();
};

/** À placer après `authenticate`. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
}
