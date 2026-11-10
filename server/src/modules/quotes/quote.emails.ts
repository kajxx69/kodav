import { formatFcfa, type QuoteDto } from '@kodav/shared';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { sendTemplatedMail } from '../../lib/mailer.js';
import { getPublicSettings } from '../settings/settings.service.js';
import { renderQuotePdf } from './quote.pdf.js';

const rangeText = (min: number, max: number) =>
  min === max ? formatFcfa(min) : `${formatFcfa(min)} à ${formatFcfa(max)}`;

async function pdfAttachment(quote: QuoteDto) {
  const { brand } = await getPublicSettings();
  try {
    const content = await renderQuotePdf(quote, brand);
    return [{ filename: `${quote.reference}.pdf`, content, contentType: 'application/pdf' }];
  } catch (err) {
    // Sans PDF, l'email part quand même : le devis reste consultable en ligne.
    logger.error({ err, reference: quote.reference }, 'Génération du PDF impossible');
    return [];
  }
}

const firstName = (name: string) => name.split(' ')[0] ?? name;

export async function sendQuoteReceivedEmail(quote: QuoteDto) {
  const e = quote.estimate;
  await sendTemplatedMail({
    to: quote.contact.email,
    subject: `Votre demande de devis ${quote.reference}`,
    template: {
      key: 'quote_received',
      vars: {
        prenom: firstName(quote.contact.name),
        reference: quote.reference,
        estimation: rangeText(e.total.min, e.total.max),
      },
    },
    greeting: `Bonjour ${firstName(quote.contact.name)},`,
    paragraphs: [
      `Nous avons bien reçu votre demande (référence ${quote.reference}). Vous trouverez en pièce jointe le récapitulatif et l’estimation calculée en ligne : ${rangeText(e.total.min, e.total.max)}${e.hasOnQuoteItems ? ', hors prestations sur devis' : ''}.`,
      'Notre équipe étudie votre demande et vous adresse un devis définitif rapidement.',
    ],
    action: quote.hasAccount
      ? { label: 'Suivre ma demande', url: `${env.CLIENT_URL}/espace-client/devis/${quote.id}` }
      : { label: 'Créer mon compte pour suivre la demande', url: `${env.CLIENT_URL}/inscription` },
    footnote: quote.hasAccount
      ? undefined
      : 'Créez votre compte avec cette même adresse email : la demande y sera rattachée automatiquement.',
    attachments: await pdfAttachment(quote),
  });
}

export async function sendTeamNewQuoteEmail(quote: QuoteDto) {
  const { brand } = await getPublicSettings();
  if (!brand.email) return;
  await sendTemplatedMail({
    to: brand.email,
    subject: `Nouvelle demande de devis ${quote.reference}`,
    greeting: 'Bonjour,',
    paragraphs: [
      `${quote.contact.name}${quote.contact.company ? ` (${quote.contact.company})` : ''} a demandé un devis : ${quote.estimate.lines.map((l) => l.name).join(', ')}.`,
      `Estimation : ${rangeText(quote.estimate.total.min, quote.estimate.total.max)}. Téléphone : ${quote.contact.phone}.`,
    ],
    action: { label: 'Ouvrir la demande', url: `${env.CLIENT_URL}/admin/devis/${quote.id}` },
  });
}

export async function sendQuoteSentEmail(quote: QuoteDto, actionToken: string, message: string) {
  await sendTemplatedMail({
    to: quote.contact.email,
    subject: `Votre devis ${quote.reference}`,
    template: {
      key: 'quote_sent',
      vars: {
        prenom: firstName(quote.contact.name),
        reference: quote.reference,
        montant: formatFcfa(quote.finalTotals?.total ?? 0),
        validite: quote.validUntil
          ? new Intl.DateTimeFormat('fr-FR', {
              dateStyle: 'long',
              timeZone: 'Africa/Abidjan',
            }).format(new Date(quote.validUntil))
          : '',
      },
    },
    greeting: `Bonjour ${firstName(quote.contact.name)},`,
    paragraphs: [
      `Veuillez trouver ci-joint notre devis ${quote.reference} d’un montant de ${formatFcfa(quote.finalTotals?.total ?? 0)}.`,
      ...(message ? [message] : []),
      'Vous pouvez l’accepter ou le refuser en ligne, en un clic.',
    ],
    action: {
      label: 'Répondre au devis',
      url: `${env.CLIENT_URL}/devis/reponse?token=${actionToken}`,
    },
    footnote: quote.validUntil
      ? `Ce devis est valable jusqu’au ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Africa/Abidjan' }).format(new Date(quote.validUntil))}. Le lien ne peut servir qu’une fois.`
      : undefined,
    attachments: await pdfAttachment(quote),
  });
}

export async function sendTeamDecisionEmail(quote: QuoteDto) {
  const { brand } = await getPublicSettings();
  if (!brand.email) return;
  const accepted = quote.status === 'accepte';
  await sendTemplatedMail({
    to: brand.email,
    subject: `Devis ${quote.reference} ${accepted ? 'accepté' : 'refusé'}`,
    greeting: 'Bonjour,',
    paragraphs: [
      `${quote.contact.name} a ${accepted ? 'accepté' : 'refusé'} le devis ${quote.reference}.`,
      ...(quote.decisionReason ? [`Motif indiqué : ${quote.decisionReason}`] : []),
      ...(accepted ? ['Pensez à planifier l’intervention avec le client.'] : []),
    ],
    action: { label: 'Ouvrir le devis', url: `${env.CLIENT_URL}/admin/devis/${quote.id}` },
  });
}
