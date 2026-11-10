import type { Config } from '@react-router/dev/config';
import {
  CLIENT_PROFILES,
  PROFILE_META,
  type ApiResponse,
  type CategoryWithServices,
} from '@kodav/shared';
import { seedCategories, seedServices } from '@kodav/shared/seed';
import { loadEnv } from 'vite';

const STATIC_PATHS = [
  '/',
  '/services',
  '/contrats-maintenance',
  '/realisations',
  '/a-propos',
  '/contact',
  '/faq',
  '/mentions-legales',
  '/confidentialite',
  '/cgv',
  '/diagnostic',
  '/devis',
  '/rendez-vous',
  '/suivi',
  '/bilan-informatique',
  ...CLIENT_PROFILES.map((p) => `/solutions/${PROFILE_META[p].solutionSlug}`),
];

/** Pages de services : lues dans l'API au build, ou dans le catalogue du seed à défaut. */
async function catalogPaths(): Promise<string[]> {
  const env = loadEnv('production', '..', 'VITE_');
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:4000/api/v1';
  try {
    const res = await fetch(`${apiUrl}/catalog/categories`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as ApiResponse<CategoryWithServices[]>;
    if (!body.success) throw new Error(body.error.message);
    return body.data.flatMap((c) => [
      `/services/${c.slug}`,
      ...c.services.map((s) => `/services/${c.slug}/${s.slug}`),
    ]);
  } catch (err) {
    console.warn(
      `[prérendu] API injoignable (${apiUrl}) : pages de services issues du seed, contenu chargé dans le navigateur. ${String(err)}`,
    );
    return [
      ...seedCategories.map((c) => `/services/${c.slug}`),
      ...seedServices.map((s) => `/services/${s.category}/${s.slug}`),
    ];
  }
}

/**
 * SPA sans serveur Node côté front : les pages publiques sont pré-rendues en HTML
 * statique au build (SEO), les espaces connectés restent rendus côté navigateur.
 */
export default {
  appDirectory: 'src',
  ssr: false,
  async prerender() {
    return [...STATIC_PATHS, ...(await catalogPaths())];
  },
} satisfies Config;
