import { env } from '../../config/env.js';
import { sendTemplatedMail } from '../../lib/mailer.js';

type Recipient = { email: string; firstName: string };

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function sendVerificationEmail(user: Recipient, token: string) {
  return sendTemplatedMail({
    to: user.email,
    subject: 'Confirmez votre adresse email',
    greeting: `Bonjour ${user.firstName},`,
    paragraphs: [
      'Merci d’avoir créé votre compte. Pour l’activer pleinement, confirmez votre adresse email.',
    ],
    action: {
      label: 'Confirmer mon adresse',
      url: `${env.CLIENT_URL}/verifier-email?token=${token}`,
    },
    footnote:
      'Ce lien est valable 24 heures. Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message.',
  });
}

export function sendPasswordResetEmail(user: Recipient, token: string) {
  return sendTemplatedMail({
    to: user.email,
    subject: 'Réinitialisation de votre mot de passe',
    greeting: `Bonjour ${user.firstName},`,
    paragraphs: ['Vous avez demandé à réinitialiser le mot de passe de votre compte.'],
    action: {
      label: 'Choisir un nouveau mot de passe',
      url: `${env.CLIENT_URL}/reinitialiser-mot-de-passe?token=${token}`,
    },
    footnote:
      'Ce lien est valable 1 heure et ne peut servir qu’une fois. Si vous n’avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.',
  });
}

export function sendPasswordChangedEmail(user: Recipient) {
  return sendTemplatedMail({
    to: user.email,
    subject: 'Votre mot de passe a été modifié',
    greeting: `Bonjour ${user.firstName},`,
    paragraphs: [
      'Le mot de passe de votre compte vient d’être modifié. Vos autres sessions ont été déconnectées.',
      'Si vous n’êtes pas à l’origine de ce changement, contactez-nous sans attendre.',
    ],
  });
}
