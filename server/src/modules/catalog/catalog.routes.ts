import { Router } from 'express';
import { serviceListQuerySchema } from '@kodav/shared';
import { z } from 'zod';
import { sendOk } from '../../lib/http.js';
import { SLUG_REGEX } from '../../lib/mongoose.js';
import { publicCache } from '../../middlewares/cache.js';
import { getCategory, getService, listCategories, listServices } from './catalog.service.js';

const slug = z.string().regex(SLUG_REGEX).max(80);

export const catalogRouter = Router();
catalogRouter.use(publicCache);

catalogRouter.get('/categories', async (_req, res) => {
  sendOk(res, await listCategories());
});

catalogRouter.get('/categories/:slug', async (req, res) => {
  sendOk(res, await getCategory(slug.parse(req.params.slug)));
});

catalogRouter.get('/services', async (req, res) => {
  sendOk(res, await listServices(serviceListQuerySchema.parse(req.query)));
});

catalogRouter.get('/services/:categorySlug/:slug', async (req, res) => {
  const params = z.object({ categorySlug: slug, slug }).parse(req.params);
  sendOk(res, await getService(params.categorySlug, params.slug));
});
