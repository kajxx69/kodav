import { estimateInputSchema } from '@kodav/shared';
import { Router } from 'express';
import { sendOk } from '../../lib/http.js';
import { estimateLimiter } from '../../middlewares/rateLimit.js';
import { estimate, loadPricingRules } from './pricing.service.js';

export const pricingRouter = Router();

/** Source de vérité des prix : le front affiche ce que renvoie ce calcul. */
pricingRouter.post('/estimate', estimateLimiter, async (req, res) => {
  sendOk(res, await estimate(estimateInputSchema.parse(req.body)));
});

/** Niveaux d'urgence et communes desservies, pour construire le configurateur. */
pricingRouter.get('/rules', async (_req, res) => {
  const rules = await loadPricingRules();
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  sendOk(res, {
    urgency: rules.urgency.map(({ key, label, percent }) => ({ key, label, percent })),
    communes: rules.travel.map(({ commune, fee }) => ({ commune, fee })),
    volumeDiscount: rules.volumeDiscount,
  });
});
