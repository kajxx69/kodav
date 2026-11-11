import type { Config } from '@react-router/dev/config';
import {
  CLIENT_PROFILES,
  PROFILE_META,
  type ApiResponse,
  type CategoryWithServices,
} from '@kodav/shared';
import { seedCategories, seedServices } from '@kodav/shared/seed';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
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

const PRIVATE_PATHS = ['/admin', '/espace-client', '/technicien', '/devis/reponse'];

/** sitemap.xml et robots.txt, avec l'URL publique du site (VITE_SITE_URL). */
async function writeSeoFiles(outDir: string, paths: string[]) {
  const env = loadEnv('production', '..', 'VITE_');
  const site = (env.VITE_SITE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const urls = [...new Set(paths)]
    .map((p) => `  <url><loc>${site}${p === '/' ? '/' : p}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n');
  await writeFile(
    path.join(outDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  await writeFile(
    path.join(outDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n${PRIVATE_PATHS.map((p) => `Disallow: ${p}`).join('\n')}\n\nSitemap: ${site}/sitemap.xml\n`,
  );
}

let prerendered: string[] = [];

/**
 * SPA sans serveur Node côté front : les pages publiques sont pré-rendues en HTML
 * statique au build (SEO), les espaces connectés restent rendus côté navigateur.
 */
export default {
  appDirectory: 'src',
  ssr: false,
  async prerender() {
    prerendered = [...STATIC_PATHS, ...(await catalogPaths())];
    return prerendered;
  },
  async buildEnd({ reactRouterConfig }) {
    await writeSeoFiles(path.join(reactRouterConfig.buildDirectory, 'client'), prerendered);
  },
} satisfies Config;
