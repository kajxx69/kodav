import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailTemplateKey } from '@kodav/shared';
import { env, isProd, isTest } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getPublicSettings } from '../modules/settings/settings.service.js';

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

/** Boîte d'envoi en mémoire, lue par les tests. */
export const testOutbox: Mail[] = [];

let transporter: Transporter | undefined;
function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export async function sendMail(mail: Mail) {
  if (isTest) {
    testOutbox.push(mail);
    return;
  }
  if (!env.SMTP_HOST) {
    if (isProd) {
      logger.warn({ subject: mail.subject }, 'SMTP non configuré : email non envoyé');
      return;
    }
    // Développement sans SMTP : le contenu (liens compris) s'affiche dans la console.
    const files = mail.attachments?.map((a) => a.filename).join(', ');
    logger.info(
      `Email (non envoyé, SMTP absent) à ${mail.to}\n${mail.subject}\n\n${mail.text}${files ? `\n\nPièces jointes : ${files}` : ''}`,
    );
    return;
  }
  try {
    await getTransporter().sendMail({ from: env.MAIL_FROM, ...mail });
  } catch (err) {
    // Un échec d'envoi ne doit pas faire échouer la requête : on le journalise.
    logger.error({ err, subject: mail.subject }, 'Échec d’envoi d’email');
  }
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

type TemplateInput = {
  to: string;
  subject: string;
  greeting: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
  attachments?: Mail['attachments'];
  /** Modèle personnalisable dans l'admin : remplace l'objet et le texte s'il est renseigné. */
  template?: { key: EmailTemplateKey; vars: Record<string, string> };
};

const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => vars[name] ?? '');

/** Applique le modèle personnalisé de l'admin, s'il existe et n'est pas vide. */
async function applyTemplate(input: TemplateInput): Promise<TemplateInput> {
  if (!input.template) return input;
  const { Settings, SETTINGS_KEY } = await import('../modules/settings/settings.model.js');
  const doc = await Settings.findOne({ key: SETTINGS_KEY }, { emailTemplates: 1 }).lean();
  const custom = doc?.emailTemplates?.find((t) => t.key === input.template!.key);
  if (!custom) return input;
  const { vars } = input.template;
  const paragraphs = custom.body.trim()
    ? fill(custom.body, vars)
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
    : input.paragraphs;
  return {
    ...input,
    subject: custom.subject.trim() ? fill(custom.subject, vars) : input.subject,
    paragraphs,
  };
}

/** Gabarit commun : texte brut + HTML sobre aux couleurs de la marque. */
export async function sendTemplatedMail(raw: TemplateInput) {
  const input = await applyTemplate(raw);
  const { brand } = await getPublicSettings();
  const lines = [input.greeting, '', ...input.paragraphs.flatMap((p) => [p, ''])];
  if (input.action) lines.push(`${input.action.label} : ${input.action.url}`, '');
  if (input.footnote) lines.push(input.footnote, '');
  lines.push(`L’équipe ${brand.legalName}`);

  const button = input.action
    ? `<p style="margin:28px 0"><a href="${escapeHtml(input.action.url)}" style="background:#c9a227;color:#0b1b33;padding:12px 20px;border-radius:6px;font-weight:600;text-decoration:none;display:inline-block">${escapeHtml(input.action.label)}</a></p>
<p style="font-size:13px;color:#5b6b80">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><span style="word-break:break-all">${escapeHtml(input.action.url)}</span></p>`
    : '';
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#0b1b33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:8px" cellpadding="0" cellspacing="0">
<tr><td style="background:#0b1b33;color:#ffffff;padding:18px 28px;font-size:18px;font-weight:700;border-radius:8px 8px 0 0">${escapeHtml(brand.legalName)}</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">
<p>${escapeHtml(input.greeting)}</p>
${input.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
${button}
${input.footnote ? `<p style="font-size:13px;color:#5b6b80">${escapeHtml(input.footnote)}</p>` : ''}
<p>L’équipe ${escapeHtml(brand.legalName)}</p>
</td></tr></table></td></tr></table></body></html>`;

  await sendMail({
    to: input.to,
    subject: input.subject,
    text: lines.join('\n'),
    html,
    attachments: input.attachments,
  });
}
