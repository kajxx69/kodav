import type {
  Category,
  CategoryWithServices,
  ClientProfile,
  Service as ServiceDto,
} from '@kodav/shared';
import { trusted, type Types } from 'mongoose';
import { AppError } from '../../lib/http.js';
import { ServiceCategory, Service, type CategoryDoc, type ServiceDoc } from './catalog.model.js';

type Lean<T> = T & { _id: Types.ObjectId };

function toCategoryDto(c: Lean<CategoryDoc>): Category {
  return {
    id: String(c._id),
    slug: c.slug,
    name: c.name,
    shortDescription: c.shortDescription,
    description: c.description,
    icon: c.icon,
    order: c.order,
    seo: { title: c.seo?.title ?? c.name, description: c.seo?.description ?? c.shortDescription },
  };
}

function toServiceDto(
  s: Lean<ServiceDoc>,
  category: Pick<CategoryDoc, 'slug' | 'name'>,
): ServiceDto {
  return {
    id: String(s._id),
    category: { slug: category.slug, name: category.name },
    slug: s.slug,
    name: s.name,
    shortDescription: s.shortDescription,
    longDescription: s.longDescription,
    targetProfiles: s.targetProfiles,
    estimatedDuration: s.estimatedDuration,
    pricingMode: s.pricingMode,
    unitLabel: s.unitLabel,
    // Les prix ne sont pas publiés pour un service « sur devis ».
    priceMin: s.pricingMode === 'sur_devis' ? undefined : s.priceMin,
    priceMax: s.pricingMode === 'sur_devis' ? undefined : s.priceMax,
    isPlaceholderPrice: s.isPlaceholderPrice,
    options: s.options ?? [],
    modes: s.modes,
    featured: s.featured,
    order: s.order,
    seo: {
      title: s.seo?.title ?? s.name,
      description: s.seo?.description ?? s.shortDescription,
      keywords: s.seo?.keywords ?? [],
    },
  };
}

async function activeCategories() {
  return ServiceCategory.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
}

export async function listCategories(): Promise<CategoryWithServices[]> {
  const categories = await activeCategories();
  const services = await Service.find({
    isActive: true,
    // sanitizeFilter neutralise les opérateurs : ceux construits ici sont sûrs.
    category: trusted({ $in: categories.map((c) => c._id) }),
  })
    .sort({ order: 1, name: 1 })
    .lean();
  return categories.map((c) => ({
    ...toCategoryDto(c),
    services: services.filter((s) => s.category.equals(c._id)).map((s) => toServiceDto(s, c)),
  }));
}

export async function getCategory(slug: string): Promise<CategoryWithServices> {
  const category = await ServiceCategory.findOne({ slug, isActive: true }).lean();
  if (!category) throw AppError.notFound('Pôle introuvable');
  const services = await Service.find({ category: category._id, isActive: true })
    .sort({ order: 1, name: 1 })
    .lean();
  return { ...toCategoryDto(category), services: services.map((s) => toServiceDto(s, category)) };
}

export async function listServices(filters: {
  profile?: ClientProfile;
  category?: string;
  featured?: boolean;
}): Promise<ServiceDto[]> {
  const categories = await activeCategories();
  const scoped = filters.category
    ? categories.filter((c) => c.slug === filters.category)
    : categories;
  const services = await Service.find({
    isActive: true,
    category: trusted({ $in: scoped.map((c) => c._id) }),
    ...(filters.profile ? { targetProfiles: filters.profile } : {}),
    ...(filters.featured === undefined ? {} : { featured: filters.featured }),
  })
    .sort({ order: 1, name: 1 })
    .lean();
  const byId = new Map(scoped.map((c) => [String(c._id), c]));
  return services.map((s) => toServiceDto(s, byId.get(String(s.category))!));
}

export async function getService(categorySlug: string, slug: string): Promise<ServiceDto> {
  const category = await ServiceCategory.findOne({ slug: categorySlug, isActive: true }).lean();
  const service =
    category && (await Service.findOne({ category: category._id, slug, isActive: true }).lean());
  if (!category || !service) throw AppError.notFound('Service introuvable');
  return toServiceDto(service, category);
}
