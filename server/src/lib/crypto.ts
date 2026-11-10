import { createHmac, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { env } from '../config/env.js';

/** Jeton opaque envoyé au client (cookie ou lien email) : 32 octets en base64url. */
export function generateToken() {
  return randomBytes(32).toString('base64url');
}

/**
 * Empreinte stockée en base : HMAC-SHA256 avec un secret serveur, pour qu'une fuite
 * de la base ne permette ni de rejouer ni de deviner un jeton.
 */
export function hashToken(token: string) {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Hash factice : un email inconnu prend autant de temps qu'un mauvais mot de passe.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword(generateToken());
  await verifyPassword(await dummyHash, password);
}
