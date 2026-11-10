import { Router } from 'express';
import type { MaintenancePlan } from '@kodav/shared';
import { sendOk } from '../../lib/http.js';
import { publicCache } from '../../middlewares/cache.js';
import { Plan } from './plans.model.js';

export const plansRouter = Router();

plansRouter.get('/', publicCache, async (_req, res) => {
  const plans = await Plan.find({ isActive: true }).sort({ order: 1 }).lean();
  const data: MaintenancePlan[] = plans.map(({ _id, isActive: _a, ...plan }) => ({
    ...plan,
    id: String(_id),
  }));
  sendOk(res, data);
});
