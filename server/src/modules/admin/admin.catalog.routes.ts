import { adminServiceUpdateSchema, estimateInputSchema, type AdminService } from '@kodav/shared';
import { Router } from 'express';
import { AppError, sendOk } from '../../lib/http.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { Service, ServiceCategory } from '../catalog/catalog.model.js';
import { estimate } from '../pricing/pricing.service.js';

export const adminCatalogRouter = Router();
adminCatalogRouter.use(authenticate, requireRole('admin'));

async function listAdminServices(): Promise<AdminService[]> {
  const [categories, services] = await Promise.all([
    ServiceCategory.find().sort({ order: 1 }).lean(),
    Service.find().sort({ order: 1, name: 1 }).lean(),
  ]);
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const order = new Map(categories.map((c, i) => [String(c._id), i]));
  return services
    .filter((s) => byId.has(String(s.category)))
    .sort((a, b) => order.get(String(a.category))! - order.get(String(b.category))!)
    .map((s) => {
      const c = byId.get(String(s.category))!;
      return {
        id: String(s._id),
        category: { slug: c.slug, name: c.name },
        slug: s.slug,
        name: s.name,
        shortDescription: s.shortDescription,
        longDescription: s.longDescription,
        targetProfiles: s.targetProfiles,
        estimatedDuration: s.estimatedDuration,
        pricingMode: s.pricingMode,
        unitLabel: s.unitLabel,
        priceMin: s.priceMin,
        priceMax: s.priceMax,
        isPlaceholderPrice: s.isPlaceholderPrice,
        options: s.options ?? [],
        modes: s.modes,
        featured: s.featured,
        order: s.order,
        seo: {
          title: s.seo?.title ?? s.name,
          description: s.seo?.description ?? '',
          keywords: s.seo?.keywords ?? [],
        },
        isActive: s.isActive,
        categoryActive: c.isActive,
      };
    });
}

adminCatalogRouter.get('/services', async (_req, res) => {
  sendOk(res, await listAdminServices());
});

/** Tarifs d'un service : une fois modifiés par l'admin, ils ne sont plus des prix d'exemple. */
adminCatalogRouter.patch('/services/:id', async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw AppError.notFound('Service introuvable');
  const { priceMin, priceMax, ...rest } = adminServiceUpdateSchema.parse(req.body);
  const update =
    rest.pricingMode === 'sur_devis'
      ? { ...rest, $unset: { priceMin: 1, priceMax: 1 } }
      : { ...rest, priceMin, priceMax };
  const service = await Service.findByIdAndUpdate(
    req.params.id,
    { ...update, isPlaceholderPrice: false },
    { new: true, runValidators: true },
  );
  if (!service) throw AppError.notFound('Service introuvable');
  const all = await listAdminServices();
  sendOk(
    res,
    all.find((s) => s.id === req.params.id),
  );
});

/** Aperçu du calcul : même moteur que le site, services inactifs exclus. */
adminCatalogRouter.post('/pricing/preview', async (req, res) => {
  sendOk(res, await estimate(estimateInputSchema.parse(req.body)));
});
