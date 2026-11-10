import {
  changePasswordInputSchema,
  emailOnlySchema,
  loginInputSchema,
  registerInputSchema,
  resetPasswordInputSchema,
  updateMeInputSchema,
  verifyEmailInputSchema,
} from '@kodav/shared';
import { Router, type RequestHandler } from 'express';
import { logger } from '../../config/logger.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/crypto.js';
import { AppError, sendOk } from '../../lib/http.js';
import { authenticate } from '../../middlewares/auth.js';
import { authLimiter } from '../../middlewares/rateLimit.js';
import { verifyTurnstile } from '../../middlewares/turnstile.js';
import { Organization } from '../organizations/organization.model.js';
import { attachVisitorQuotes } from '../quotes/quote.service.js';
import { User } from '../users/user.model.js';
import {
  EMAIL_VERIFY_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from './auth.emails.js';
import {
  clearRefreshCookie,
  consumeOneTimeToken,
  createOneTimeToken,
  issueSession,
  loadAuthUser,
  readRefreshCookie,
  revokeSessionFamily,
  revokeUserSessions,
  rotateSession,
} from './auth.service.js';

export const authRouter = Router();

/**
 * Les routes qui lisent le cookie exigent un en-tête personnalisé : un site tiers ne peut
 * pas l'ajouter sans requête préalable CORS, refusée hors liste blanche (protection CSRF).
 */
const requireAppHeader: RequestHandler = (req, _res, next) => {
  if (req.get('X-Requested-With') !== 'kodav') throw AppError.forbidden();
  next();
};

const isDuplicateKey = (err: unknown) =>
  typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;

authRouter.post('/register', authLimiter, verifyTurnstile, async (req, res) => {
  const {
    website,
    consent: _consent,
    organizationName,
    ...input
  } = registerInputSchema.parse(req.body);
  if (website) {
    sendOk(res, { received: true }, 201);
    return;
  }

  const duplicate = () =>
    AppError.conflict('Un compte existe déjà avec cette adresse email', [
      { path: 'email', message: 'Un compte existe déjà avec cette adresse email' },
    ]);
  if (await User.exists({ email: input.email })) throw duplicate();

  let user;
  try {
    user = await User.create({
      ...input,
      passwordHash: await hashPassword(input.password),
      role: 'client',
    });
  } catch (err) {
    // Deux inscriptions simultanées : l'index unique tranche.
    if (isDuplicateKey(err)) throw duplicate();
    throw err;
  }

  if (input.profile !== 'particulier') {
    try {
      const org = await Organization.create({
        name: organizationName,
        type: input.profile,
        owner: user._id,
        email: input.email,
        phone: input.phone,
      });
      await User.updateOne({ _id: user._id }, { organization: org._id, orgRole: 'owner' });
    } catch (err) {
      await User.deleteOne({ _id: user._id });
      throw err;
    }
  }

  const token = await createOneTimeToken(user._id, 'email_verify', EMAIL_VERIFY_TTL_MS);
  await sendVerificationEmail(user, token);
  logger.info({ userId: user.id }, 'Nouveau compte client');

  sendOk(res, await issueSession(res, user._id), 201);
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { email, password } = loginInputSchema.parse(req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    await burnPasswordCheck(password);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect');
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect');
  }
  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'Ce compte est désactivé. Contactez-nous.');
  }
  user.lastLoginAt = new Date();
  await user.save();
  sendOk(res, await issueSession(res, user._id));
});

authRouter.post('/refresh', requireAppHeader, async (req, res) => {
  const token = readRefreshCookie(req);
  if (!token) throw new AppError(401, 'SESSION_EXPIRED', 'Aucune session active');
  try {
    sendOk(res, await rotateSession(res, token));
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
});

authRouter.post('/logout', requireAppHeader, async (req, res) => {
  const token = readRefreshCookie(req);
  if (token) await revokeSessionFamily(token);
  clearRefreshCookie(res);
  sendOk(res, { loggedOut: true });
});

authRouter.post('/verify-email', authLimiter, async (req, res) => {
  const { token } = verifyEmailInputSchema.parse(req.body);
  const userId = await consumeOneTimeToken(token, 'email_verify');
  await User.updateOne({ _id: userId, emailVerifiedAt: null }, { emailVerifiedAt: new Date() });
  // Adresse prouvée : les demandes de devis faites sans compte avec cet email sont rattachées.
  const user = await User.findById(userId).lean();
  if (user) await attachVisitorQuotes(user);
  sendOk(res, { verified: true });
});

// Réponses identiques que le compte existe ou non : aucune énumération des emails.
authRouter.post('/resend-verification', authLimiter, async (req, res) => {
  const { email } = emailOnlySchema.parse(req.body);
  const user = await User.findOne({ email, isActive: true, emailVerifiedAt: null }).lean();
  if (user) {
    const token = await createOneTimeToken(user._id, 'email_verify', EMAIL_VERIFY_TTL_MS);
    await sendVerificationEmail(user, token);
  }
  sendOk(res, { sent: true });
});

authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = emailOnlySchema.parse(req.body);
  const user = await User.findOne({ email, isActive: true }).lean();
  if (user) {
    const token = await createOneTimeToken(user._id, 'password_reset', PASSWORD_RESET_TTL_MS);
    await sendPasswordResetEmail(user, token);
  }
  sendOk(res, { sent: true });
});

authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = resetPasswordInputSchema.parse(req.body);
  const userId = await consumeOneTimeToken(token, 'password_reset');
  const user = await User.findById(userId);
  if (!user?.isActive) throw new AppError(400, 'INVALID_TOKEN', 'Ce lien est invalide ou a expiré');

  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  // Le lien reçu prouve l'accès à la boîte mail.
  user.emailVerifiedAt ??= new Date();
  await user.save();
  await revokeUserSessions(user._id);
  await sendPasswordChangedEmail(user);
  sendOk(res, { reset: true });
});

authRouter.get('/me', authenticate, async (req, res) => {
  sendOk(res, await loadAuthUser(req.user!._id));
});

authRouter.patch('/me', authenticate, async (req, res) => {
  const input = updateMeInputSchema.parse(req.body);
  await User.updateOne({ _id: req.user!._id }, input);
  sendOk(res, await loadAuthUser(req.user!._id));
});

authRouter.patch('/me/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordInputSchema.parse(req.body);
  const user = await User.findById(req.user!._id).select('+passwordHash');
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw AppError.badRequest('Mot de passe actuel incorrect', [
      { path: 'currentPassword', message: 'Mot de passe actuel incorrect' },
    ]);
  }
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  // Toutes les sessions sont fermées, puis une nouvelle est ouverte pour cet appareil.
  await revokeUserSessions(user._id);
  await sendPasswordChangedEmail(user);
  sendOk(res, await issueSession(res, user._id));
});
