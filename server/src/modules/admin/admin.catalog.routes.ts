import {
  adminCategorySchema,
  adminPlanSchema,
  adminServiceFullSchema,
  adminServiceUpdateSchema,
  estimateInputSchema,
  pricingRulesInputSchema,
  type AdminService,
} from '@kodav/shared';
import { audit } from '../../lib/audit.js';
import { Plan } from '../plans/plans.model.js';
import { PricingRule } from '../pricing/pricing.model.js';
import { Router } from 'express';
import { AppError, sendOk } from '../../lib/http.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { Service, ServiceCategory } from '../catalog/catalog.model.js';
import { estimate, loadPricingRules } from '../pricing/pricing.service.js';

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
  await audit(
    req,
    'service.price',
    'Service',
    service._id,
    `${service.name} : ${service.pricingMode} ${service.priceMin ?? ''}-${service.priceMax ?? ''}`,
  );
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

// --- Catalogue complet (phase 6) ---------------------------------------------------------

const ID = /^[a-f\d]{24}$/i;
const checkId = (id: unknown, what: string) => {
  if (typeof id !== 'string' || !ID.test(id)) throw AppError.notFound(`${what} introuvable`);
  return id;
};

adminCatalogRouter.get('/categories', async (_req, res) => {
  const categories = await ServiceCategory.find().sort({ order: 1 }).lean();
  sendOk(
    res,
    categories.map(({ _id, ...c }) => ({ id: String(_id), ...c })),
  );
});

async function saveCategory(id: string | null, body: unknown) {
  const input = adminCategorySchema.parse(body);
  const clash = await ServiceCategory.findOne({ slug: input.slug }, { _id: 1 }).lean();
  if (clash && String(clash._id) !== id) {
    throw AppError.conflict('Cette adresse est déjà utilisée', [
      { path: 'slug', message: 'Déjà utilisée' },
    ]);
  }
  if (!id) return ServiceCategory.create(input);
  const c = await ServiceCategory.findByIdAndUpdate(id, input, { new: true });
  if (!c) throw AppError.notFound('Pôle introuvable');
  return c;
}

adminCatalogRouter.post('/categories', async (req, res) => {
  const c = await saveCategory(null, req.body);
  await audit(req, 'category.create', 'ServiceCategory', c._id, c.name);
  sendOk(res, { id: String(c._id) }, 201);
});

adminCatalogRouter.put('/categories/:id', async (req, res) => {
  const c = await saveCategory(checkId(req.params.id, 'Pôle'), req.body);
  await audit(
    req,
    'category.update',
    'ServiceCategory',
    c._id,
    `${c.name}${c.isActive ? '' : ' (masqué)'}`,
  );
  sendOk(res, { id: String(c._id) });
});

/** Service complet : description, profils, durée, tarifs, options, modes, SEO. */
async function saveService(id: string | null, body: unknown) {
  const { categoryId, priceMin, priceMax, ...input } = adminServiceFullSchema.parse(body);
  if (!(await ServiceCategory.exists({ _id: categoryId })))
    throw AppError.badRequest('Pôle introuvable');
  const clash = await Service.findOne(
    { category: categoryId, slug: input.slug },
    { _id: 1 },
  ).lean();
  if (clash && String(clash._id) !== id) {
    throw AppError.conflict('Cette adresse est déjà utilisée dans ce pôle', [
      { path: 'slug', message: 'Déjà utilisée' },
    ]);
  }
  const prices =
    input.pricingMode === 'sur_devis'
      ? { $unset: { priceMin: 1, priceMax: 1 } }
      : { priceMin, priceMax };
  const fields = { ...input, category: categoryId, ...prices, isPlaceholderPrice: false };
  if (!id) {
    const { $unset: _unset, ...createFields } = fields as typeof fields & { $unset?: unknown };
    return Service.create(createFields);
  }
  const s = await Service.findByIdAndUpdate(id, fields, { new: true, runValidators: true });
  if (!s) throw AppError.notFound('Service introuvable');
  return s;
}

adminCatalogRouter.post('/services', async (req, res) => {
  const s = await saveService(null, req.body);
  await audit(req, 'service.create', 'Service', s._id, s.name);
  sendOk(
    res,
    (await listAdminServices()).find((x) => x.id === String(s._id)),
    201,
  );
});

adminCatalogRouter.put('/services/:id', async (req, res) => {
  const s = await saveService(checkId(req.params.id, 'Service'), req.body);
  await audit(req, 'service.update', 'Service', s._id, s.name);
  sendOk(
    res,
    (await listAdminServices()).find((x) => x.id === String(s._id)),
  );
});

adminCatalogRouter.get('/pricing-rules', async (_req, res) => {
  sendOk(res, await loadPricingRules());
});

adminCatalogRouter.put('/pricing-rules', async (req, res) => {
  const input = pricingRulesInputSchema.parse(req.body);
  await Promise.all([
    PricingRule.updateOne(
      { type: 'urgency' },
      { levels: input.urgency, isActive: true, isPlaceholder: false },
      { upsert: true },
    ),
    PricingRule.updateOne(
      { type: 'travel' },
      {
        zones: input.travel.map((z) => ({ ...z, isAbidjan: z.commune !== 'Hors Abidjan' })),
        outsideAbidjan: 'sur_devis',
        isActive: true,
        isPlaceholder: false,
      },
      { upsert: true },
    ),
    PricingRule.updateOne(
      { type: 'volume_discount' },
      { tiers: input.volumeDiscount, isActive: true, isPlaceholder: false },
      { upsert: true },
    ),
  ]);
  await audit(
    req,
    'pricing.update',
    'PricingRule',
    req.user!._id,
    `${input.urgency.length} niveaux, ${input.travel.length} communes, ${input.volumeDiscount.length} paliers`,
  );
  sendOk(res, await loadPricingRules());
});

adminCatalogRouter.get('/plans', async (_req, res) => {
  const plans = await Plan.find().sort({ order: 1 }).lean();
  sendOk(
    res,
    plans.map(({ _id, ...p }) => ({ id: String(_id), ...p })),
  );
});

adminCatalogRouter.put('/plans/:id', async (req, res) => {
  const input = adminPlanSchema.parse(req.body);
  const p = await Plan.findByIdAndUpdate(
    checkId(req.params.id, 'Formule'),
    { ...input, isPlaceholderPrice: false },
    { new: true },
  );
  if (!p) throw AppError.notFound('Formule introuvable');
  await audit(req, 'plan.update', 'MaintenancePlan', p._id, p.name);
  sendOk(res, { id: String(p._id) });
});
