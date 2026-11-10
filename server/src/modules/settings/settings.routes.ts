import { Router } from 'express';
import { sendOk } from '../../lib/http.js';
import { publicCache } from '../../middlewares/cache.js';
import { getPublicSettings } from './settings.service.js';

export const settingsRouter = Router();

settingsRouter.get('/public', publicCache, async (_req, res) => {
  sendOk(res, await getPublicSettings());
});
