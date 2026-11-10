import type {
  CategoryWithServices,
  ClientProfile,
  Faq,
  MaintenancePlan,
  Project,
  PublicSettings,
  Service,
  Testimonial,
} from '@kodav/shared';
import { apiRequest } from './api';

/** Requête API : clé de cache + appel, partagée entre loaders (build), clientLoaders et composants. */
export type ApiQuery<T> = { queryKey: readonly unknown[]; queryFn: () => Promise<T> };

function apiQuery<T>(queryKey: readonly unknown[], path: string): ApiQuery<T> {
  return { queryKey, queryFn: () => apiRequest<T>(path) };
}

const enc = encodeURIComponent;

export const queries = {
  settings: () => apiQuery<PublicSettings>(['settings', 'public'], '/settings/public'),
  categories: () =>
    apiQuery<CategoryWithServices[]>(['catalog', 'categories'], '/catalog/categories'),
  category: (slug: string) =>
    apiQuery<CategoryWithServices>(
      ['catalog', 'categories', slug],
      `/catalog/categories/${enc(slug)}`,
    ),
  services: (filters: { profile?: ClientProfile; featured?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filters.profile) params.set('profile', filters.profile);
    if (filters.featured !== undefined) params.set('featured', String(filters.featured));
    const qs = params.toString();
    return apiQuery<Service[]>(
      ['catalog', 'services', filters],
      `/catalog/services${qs ? `?${qs}` : ''}`,
    );
  },
  service: (pole: string, slug: string) =>
    apiQuery<Service>(
      ['catalog', 'service', pole, slug],
      `/catalog/services/${enc(pole)}/${enc(slug)}`,
    ),
  plans: () => apiQuery<MaintenancePlan[]>(['plans'], '/plans'),
  faqs: () => apiQuery<Faq[]>(['content', 'faqs'], '/content/faqs'),
  testimonials: () => apiQuery<Testimonial[]>(['content', 'testimonials'], '/content/testimonials'),
  projects: () => apiQuery<Project[]>(['content', 'projects'], '/content/projects'),
  project: (slug: string) =>
    apiQuery<Project>(['content', 'projects', slug], `/content/projects/${enc(slug)}`),
};
