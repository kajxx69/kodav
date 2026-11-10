import { z } from 'zod';
import { CLIENT_PROFILES, ORG_ROLES, USER_ROLES } from '../enums.js';
import { ciPhoneSchema } from './contact.js';

export const PASSWORD_MIN_LENGTH = 10;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères`)
  .max(128, '128 caractères maximum')
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
    message: 'Au moins une lettre et un chiffre',
  });

/**
 * Une règle entre champs ne s'exécute par défaut que si tout l'objet est valide :
 * `when` la déclenche dès que les champs qu'elle lit le sont (erreurs affichées ensemble).
 */
const whenValid =
  (...fields: string[]) =>
  (payload: { issues: readonly { path?: readonly PropertyKey[] }[] }) =>
    !payload.issues.some((issue) => fields.includes(String(issue.path?.[0])));

const emailSchema = z.email('Adresse email invalide').trim().toLowerCase().max(200);
const nameSchema = (message: string) => z.string().trim().min(1, message).max(80);

/** Un jeton reçu par email : 43 caractères base64url (32 octets aléatoires). */
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/, 'Lien invalide');

export const registerInputSchema = z
  .object({
    firstName: nameSchema('Indiquez votre prénom'),
    lastName: nameSchema('Indiquez votre nom'),
    email: emailSchema,
    phone: ciPhoneSchema,
    password: passwordSchema,
    profile: z.enum(CLIENT_PROFILES, { error: 'Choisissez votre profil' }),
    /** Obligatoire pour une PME, une école ou une grande entreprise. */
    organizationName: z.string().trim().max(160).optional().default(''),
    consent: z.literal(true, { error: 'Votre accord est nécessaire pour créer un compte' }),
    website: z.string().max(500).optional().default(''),
  })
  .refine((input) => input.profile === 'particulier' || input.organizationName.length >= 2, {
    path: ['organizationName'],
    message: 'Indiquez le nom de votre structure',
    when: whenValid('profile', 'organizationName'),
  });
export type RegisterInput = z.input<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Indiquez votre mot de passe').max(128),
});
export type LoginInput = z.input<typeof loginInputSchema>;

export const emailOnlySchema = z.object({ email: emailSchema });
export type EmailOnlyInput = z.input<typeof emailOnlySchema>;

export const verifyEmailInputSchema = z.object({ token: tokenSchema });

export const resetPasswordInputSchema = z
  .object({
    token: tokenSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
    when: whenValid('password', 'confirmPassword'),
  });
export type ResetPasswordInput = z.input<typeof resetPasswordInputSchema>;

export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1, 'Indiquez votre mot de passe actuel').max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
    when: whenValid('newPassword', 'confirmPassword'),
  })
  .refine((input) => input.newPassword !== input.currentPassword, {
    path: ['newPassword'],
    message: 'Choisissez un mot de passe différent de l’actuel',
    when: whenValid('newPassword', 'currentPassword'),
  });
export type ChangePasswordInput = z.input<typeof changePasswordInputSchema>;

export const updateMeInputSchema = z.object({
  firstName: nameSchema('Indiquez votre prénom'),
  lastName: nameSchema('Indiquez votre nom'),
  phone: ciPhoneSchema,
  notificationPrefs: z.object({ email: z.boolean() }).optional(),
});
export type UpdateMeInput = z.input<typeof updateMeInputSchema>;

export const organizationSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(CLIENT_PROFILES),
});

/** Utilisateur tel que renvoyé au front (jamais de hash ni de jeton). */
export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  role: z.enum(USER_ROLES),
  profile: z.enum(CLIENT_PROFILES).nullable(),
  organization: organizationSummarySchema.nullable(),
  orgRole: z.enum(ORG_ROLES).nullable(),
  emailVerified: z.boolean(),
  notificationPrefs: z.object({ email: z.boolean() }),
  createdAt: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export type AuthSession = { accessToken: string; user: AuthUser };

export const organizationSchema = organizationSummarySchema.extend({
  taxId: z.string(),
  rccm: z.string(),
  phone: z.string(),
  email: z.string(),
  address: z.object({ street: z.string(), commune: z.string(), city: z.string() }),
});
export type Organization = z.infer<typeof organizationSchema>;

export const updateOrganizationInputSchema = z.object({
  name: z.string().trim().min(2, 'Indiquez le nom de votre structure').max(160),
  taxId: z.string().trim().max(40).optional().default(''),
  rccm: z.string().trim().max(60).optional().default(''),
  phone: z
    .union([ciPhoneSchema, z.literal('')])
    .optional()
    .default(''),
  email: z
    .union([emailSchema, z.literal('')])
    .optional()
    .default(''),
  address: z
    .object({
      street: z.string().trim().max(200).optional().default(''),
      commune: z.string().trim().max(80).optional().default(''),
      city: z.string().trim().max(80).optional().default('Abidjan'),
    })
    .optional()
    .default({ street: '', commune: '', city: 'Abidjan' }),
});
export type UpdateOrganizationInput = z.input<typeof updateOrganizationInputSchema>;

/** Pagination commune des listes : ?page=1&limit=20. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Paginated<T> = { items: T[]; page: number; limit: number; total: number };

export const adminUserListQuerySchema = paginationQuerySchema.extend({
  role: z.enum(USER_ROLES).optional(),
  q: z.string().trim().max(100).optional(),
});

export type AdminOverview = {
  users: Record<(typeof USER_ROLES)[number], number>;
  newLeads: number;
  placeholderPrices: number;
};
