import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
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

/** Chiffrement réversible (AES-256-GCM) : iv.tag.données, en base64url. */
export function encryptSecret(plain: string) {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decryptSecret(payload: string) {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(env.ENCRYPTION_KEY, 'base64'), iv!);
  decipher.setAuthTag(tag!);
  return Buffer.concat([decipher.update(data!), decipher.final()]).toString('utf8');
}
