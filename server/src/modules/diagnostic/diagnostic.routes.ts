import {
  DIAGNOSTIC_NEEDS,
  DIAGNOSTIC_URGENCIES,
  diagnosticInputSchema,
  type DiagnosticResult,
} from '@kodav/shared';
import { Router } from 'express';
import { trusted } from 'mongoose';
import { sendOk } from '../../lib/http.js';
import { estimateLimiter } from '../../middlewares/rateLimit.js';
import { Service, ServiceCategory } from '../catalog/catalog.model.js';

export const diagnosticRouter = Router();

/** Diagnostic Express : 1 à 3 services adaptés au profil, au besoin et au mode souhaité. */
diagnosticRouter.post('/recommend', estimateLimiter, async (req, res) => {
  const input = diagnosticInputSchema.parse(req.body);
  const need = DIAGNOSTIC_NEEDS.find((n) => n.key === input.need)!;

  const activeCategories = await ServiceCategory.find({ isActive: true }, { _id: 1 }).lean();
  const services = await Service.find(
    {
      slug: trusted({ $in: need.services.map((s) => s.slug) }),
      isActive: true,
      category: trusted({ $in: activeCategories.map((c) => c._id) }),
    },
    { slug: 1, targetProfiles: 1, modes: 1 },
  ).lean();
  const bySlug = new Map(services.map((s) => [s.slug, s]));

  const candidates = need.services
    .map((entry, index) => ({ entry, index, service: bySlug.get(entry.slug) }))
    .filter((c) => c.service);
  // Services adaptés au profil d'abord, puis compatibles avec le mode demandé, puis l'ordre prévu.
  const score = (c: (typeof candidates)[number]) =>
    (c.service!.targetProfiles.includes(input.profile) ? 0 : 10) +
    (input.mode === 'indifferent' || c.service!.modes.includes(input.mode) ? 0 : 5) +
    c.index;
  const recommendations = candidates
    .sort((a, b) => score(a) - score(b))
    .slice(0, 3)
    .map((c) => ({ serviceId: String(c.service!._id), reason: c.entry.reason }));

  const first = candidates[0]?.service;
  const mode =
    input.mode !== 'indifferent'
      ? input.mode
      : first?.modes.includes('distance') && !first.modes.includes('sur_site')
        ? 'distance'
        : 'sur_site';

  sendOk(res, {
    recommendations,
    prefill: {
      profile: input.profile,
      urgency: DIAGNOSTIC_URGENCIES.find((u) => u.key === input.urgency)!.urgency,
      mode,
      commune: input.commune ?? null,
    },
  } satisfies DiagnosticResult);
});
