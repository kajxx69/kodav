import {
  ASSESSMENT_LEVELS,
  assessmentInputSchema,
  scoreAssessment,
  type AssessmentResult,
} from '@kodav/shared';
import { Router } from 'express';
import { trusted } from 'mongoose';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { sendOk } from '../../lib/http.js';
import { sendTemplatedMail } from '../../lib/mailer.js';
import { publicFormLimiter } from '../../middlewares/rateLimit.js';
import { verifyTurnstile } from '../../middlewares/turnstile.js';
import { Service, ServiceCategory } from '../catalog/catalog.model.js';
import { Lead } from '../leads/lead.model.js';
import { notifyAdmins } from '../notifications/notification.service.js';
import { getPublicSettings } from '../settings/settings.service.js';
import { renderAssessmentPdf, type ServiceLink } from './assessment.pdf.js';
import { ItAssessment } from './assessment.model.js';

export const assessmentRouter = Router();

/** Liens vers les services recommandés (seulement ceux actifs dans le catalogue). */
async function serviceLinks(result: AssessmentResult) {
  const slugs = [...new Set(result.weaknesses.map((w) => w.serviceSlug))];
  const services = await Service.find(
    { slug: trusted({ $in: slugs }), isActive: true },
    { slug: 1, name: 1, category: 1 },
  ).lean();
  const categories = await ServiceCategory.find(
    { _id: trusted({ $in: services.map((s) => s.category) }), isActive: true },
    { slug: 1 },
  ).lean();
  const poles = new Map(categories.map((c) => [String(c._id), c.slug]));
  const links = new Map<string, ServiceLink>();
  for (const s of services) {
    const pole = poles.get(String(s.category));
    if (pole) {
      links.set(s.slug, { name: s.name, url: `${env.CLIENT_URL}/services/${pole}/${s.slug}` });
    }
  }
  return links;
}

/** Bilan de santé : score recalculé ici, prospect enregistré, rapport détaillé envoyé par email. */
assessmentRouter.post('/', publicFormLimiter, verifyTurnstile, async (req, res) => {
  const { website, consent: _consent, ...input } = assessmentInputSchema.parse(req.body);
  const result = scoreAssessment(input.answers);
  if (website) {
    sendOk(res, { received: true, score: result.score }, 201);
    return;
  }

  const lead = await Lead.create({
    source: 'bilan',
    name: input.name,
    email: input.email,
    phone: input.phone,
    company: input.company,
    profile: input.profile,
    subject: `Bilan de santé informatique : ${result.score}/100`,
    message: '',
    payload: { score: result.score, seats: input.seats },
    consentAt: new Date(),
    ip: req.ip,
  });
  const assessment = await ItAssessment.create({
    profile: input.profile,
    seats: input.seats,
    answers: input.answers,
    score: result.score,
    weakThemes: result.weaknesses.map((w) => w.theme),
    lead: lead._id,
  });
  await Lead.updateOne(
    { _id: lead._id },
    { payload: { ...lead.payload!, assessmentId: assessment.id } },
  );

  void (async () => {
    const [{ brand }, links] = await Promise.all([getPublicSettings(), serviceLinks(result)]);
    const pdf = await renderAssessmentPdf(
      { ...input, result, date: assessment.get('createdAt') as Date },
      brand,
      links,
    );
    const level = ASSESSMENT_LEVELS[result.level];
    await sendTemplatedMail({
      to: input.email,
      subject: `Votre bilan de santé informatique : ${result.score}/100`,
      greeting: `Bonjour ${input.name.split(' ')[0]},`,
      paragraphs: [
        `Merci d’avoir réalisé le bilan de santé informatique. Votre score est de ${result.score}/100 (${level.label.toLowerCase()}).`,
        result.weaknesses.length
          ? `Le rapport ci-joint détaille vos ${result.weaknesses.length} points d’amélioration, du plus urgent au moins urgent, avec nos recommandations.`
          : 'Le rapport ci-joint reprend vos réponses : aucun point faible n’a été relevé.',
        'Un conseiller peut vous rappeler pour en parler, sans engagement.',
      ],
      action: { label: 'Demander un devis', url: `${env.CLIENT_URL}/devis` },
      attachments: [
        { filename: 'bilan-sante-informatique.pdf', content: pdf, contentType: 'application/pdf' },
      ],
    });
    await notifyAdmins({
      type: 'lead_new',
      title: `Nouveau bilan informatique : ${result.score}/100`,
      body: [input.name, input.company].filter(Boolean).join(' · '),
      link: '/admin/prospects',
    });
  })().catch((err: unknown) => logger.error({ err }, 'Envoi du bilan informatique'));

  sendOk(res, { received: true, score: result.score }, 201);
});
