import { CLIENT_PROFILES, ORG_ROLES, USER_ROLES, type AuthUser } from '@kodav/shared';
import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { baseSchemaOptions } from '../../lib/mongoose.js';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    role: { type: String, enum: USER_ROLES, required: true, default: 'client', index: true },
    profile: { type: String, enum: [...CLIENT_PROFILES, null], default: null },
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    orgRole: { type: String, enum: [...ORG_ROLES, null], default: null },
    emailVerifiedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    /** Les access tokens émis avant cette date sont refusés (changement de mot de passe). */
    passwordChangedAt: { type: Date, default: null },
    notificationPrefs: { email: { type: Boolean, default: true } },
  },
  {
    ...baseSchemaOptions,
    toJSON: {
      ...baseSchemaOptions.toJSON,
      transform(doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        return baseSchemaOptions.toJSON.transform(doc, ret);
      },
    },
  },
);
userSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};
export const User = model('User', userSchema);

type OrgSummary = { _id: Types.ObjectId; name: string; type: AuthUser['profile'] };

/** Forme publique d'un utilisateur, organisation peuplée ou non. */
export function toAuthUser(user: Omit<UserDoc, 'organization'> & { organization?: unknown }) {
  const org = user.organization as OrgSummary | Types.ObjectId | null | undefined;
  const populated = org && typeof org === 'object' && 'name' in org ? org : null;
  return {
    id: String(user._id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? '',
    role: user.role,
    profile: user.profile ?? null,
    organization: populated
      ? { id: String(populated._id), name: populated.name, type: populated.type! }
      : null,
    orgRole: user.orgRole ?? null,
    emailVerified: Boolean(user.emailVerifiedAt),
    notificationPrefs: { email: user.notificationPrefs?.email ?? true },
    createdAt: user.createdAt.toISOString(),
  } satisfies AuthUser;
}
