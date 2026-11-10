import type { MetaDescriptor } from 'react-router';
import type { RootData } from './useSettings';

export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'http://localhost:5173').replace(
  /\/$/,
  '',
);

type MetaMatches = readonly ({ id: string; loaderData?: unknown } | undefined)[];

/** Paramètres de marque chargés par la route racine (pour les titres d'onglet). */
export function brandFromMatches(matches: MetaMatches) {
  const root = matches.find((m) => m?.id === 'root')?.loaderData as RootData | undefined;
  return root?.settings?.brand ?? null;
}

type PageSeo = {
  title: string;
  description: string;
  path: string;
  /** Titre complet sans suffixe de marque (accueil). */
  absoluteTitle?: boolean;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

/** Balises d'une page : titre, description, Open Graph, URL canonique, données structurées. */
export function pageMeta(matches: MetaMatches, page: PageSeo): MetaDescriptor[] {
  const brand = brandFromMatches(matches);
  const title = page.absoluteTitle || !brand ? page.title : `${page.title} · ${brand.shortName}`;
  const url = `${SITE_URL}${page.path}`;
  const tags: MetaDescriptor[] = [
    { title },
    { name: 'description', content: page.description },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'fr_CI' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: page.description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: `${SITE_URL}/og-image.png` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { tagName: 'link', rel: 'canonical', href: url },
  ];
  if (brand) tags.push({ property: 'og:site_name', content: brand.legalName });
  if (page.noindex) tags.push({ name: 'robots', content: 'noindex' });
  if (page.jsonLd) tags.push({ 'script:ld+json': page.jsonLd });
  return tags;
}

/** « /cgv/ » (pré-rendu) → « /cgv ». */
export function normalizePath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}
