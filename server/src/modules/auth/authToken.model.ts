import { Schema, model } from 'mongoose';

export const AUTH_TOKEN_TYPES = [
  'refresh',
  'email_verify',
  'password_reset',
  'quote_action',
] as const;
export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

/** Jetons stockés hachés uniquement ; supprimés automatiquement à expiration (index TTL). */
const authTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: AUTH_TOKEN_TYPES, required: true },
    tokenHash: { type: String, required: true, unique: true },
    /** Famille de rotation des refresh tokens : révoquée entière en cas de réutilisation. */
    family: { type: String, default: null, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

export const AuthToken = model('AuthToken', authTokenSchema);
