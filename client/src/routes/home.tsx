import { LayoutGroup, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { DiagnosticTeaser } from '~/features/home/DiagnosticTeaser';
import { FaqSection } from '~/features/home/FaqSection';
import { FeaturedServices } from '~/features/home/FeaturedServices';
import { FinalCta } from '~/features/home/FinalCta';
import { Hero } from '~/features/home/Hero';
import { MethodSection } from '~/features/home/MethodSection';
import { PlansTeaser } from '~/features/home/PlansTeaser';
import { PolesSection } from '~/features/home/PolesSection';
import { ProjectsSection } from '~/features/home/ProjectsSection';
import { StatsSection } from '~/features/home/StatsSection';
import { TestimonialsSection } from '~/features/home/TestimonialsSection';
import { UseCases } from '~/features/home/UseCases';
import { genericContent, profileContent } from '~/content/profiles';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { SITE_URL, brandFromMatches, pageMeta } from '~/lib/seo';
import { useSettings } from '~/lib/useSettings';
import { useProfileStore } from '~/stores/profile';
import type { Route } from './+types/home';

/** Même chargement au build (`fetchAtBuild`) et dans le navigateur (`fetchInBrowser`). */
async function loadHome(fetch: typeof fetchAtBuild) {
  const [categories, plans, faqs, testimonials, projects] = await Promise.all([
    fetch(queries.categories()),
    fetch(queries.plans()),
    fetch(queries.faqs()),
    fetch(queries.testimonials()),
    fetch(queries.projects()),
  ]);
  return { categories, plans, faqs, testimonials, projects };
}

export const loader = () => loadHome(fetchAtBuild);
export const clientLoader = () => loadHome(fetchInBrowser);

export function meta({ matches }: Route.MetaArgs) {
  const brand = brandFromMatches(matches);
  const title = brand
    ? `${brand.shortName} · ${brand.tagline}`
    : 'Services informatiques à Abidjan';
  return pageMeta(matches, {
    title,
    absoluteTitle: true,
    description:
      'Développement, réseaux et systèmes, logiciels professionnels, maintenance et dépannage informatique à Abidjan, pour particuliers, PME, écoles et grandes entreprises.',
    path: '/',
    jsonLd: brand
      ? {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: brand.legalName,
          alternateName: brand.shortName,
          slogan: brand.tagline,
          url: SITE_URL,
          logo: `${SITE_URL}/icons/icon-512.png`,
          image: `${SITE_URL}/og-image.png`,
          email: brand.email,
          ...(/^\+225\d{10}$/.test(brand.phone) ? { telephone: brand.phone } : {}),
          areaServed: { '@type': 'City', name: 'Abidjan' },
          address: { '@type': 'PostalAddress', addressLocality: 'Abidjan', addressCountry: 'CI' },
          sameAs: Object.values(brand.social).filter(Boolean),
        }
      : undefined,
  });
}

type SectionKey =
  | 'services'
  | 'useCases'
  | 'plans'
  | 'diagnostic'
  | 'poles'
  | 'method'
  | 'projects'
  | 'testimonials'
  | 'stats'
  | 'faq';

// Ordre des sections selon le profil : le plus pertinent remonte.
const sectionOrder: Record<string, SectionKey[]> = {
  generic: [
    'poles',
    'services',
    'diagnostic',
    'useCases',
    'method',
    'plans',
    'projects',
    'testimonials',
    'stats',
    'faq',
  ],
  particulier: [
    'services',
    'diagnostic',
    'useCases',
    'method',
    'poles',
    'projects',
    'testimonials',
    'stats',
    'faq',
  ],
  pme: [
    'services',
    'plans',
    'useCases',
    'poles',
    'method',
    'diagnostic',
    'projects',
    'testimonials',
    'stats',
    'faq',
  ],
  ecole: [
    'useCases',
    'plans',
    'services',
    'poles',
    'method',
    'diagnostic',
    'projects',
    'testimonials',
    'stats',
    'faq',
  ],
  grande_entreprise: [
    'poles',
    'useCases',
    'services',
    'method',
    'projects',
    'testimonials',
    'stats',
    'diagnostic',
    'faq',
  ],
};

export default function Home({ loaderData }: Route.ComponentProps) {
  const profile = useProfileStore((s) => s.profile);
  const settings = useSettings().data;
  const content = profile ? profileContent[profile] : genericContent;

  const categories = useLiveQuery(queries.categories(), loaderData.categories).data;
  const plans = useLiveQuery(queries.plans(), loaderData.plans).data ?? [];
  const faqs = useLiveQuery(queries.faqs(), loaderData.faqs).data ?? [];
  const testimonials = useLiveQuery(queries.testimonials(), loaderData.testimonials).data ?? [];
  const projects = useLiveQuery(queries.projects(), loaderData.projects).data ?? [];
  const services = categories?.flatMap((c) => c.services);

  const sections: Record<SectionKey, ReactNode> = {
    services: <FeaturedServices services={services} profile={profile} />,
    useCases: <UseCases useCases={content.useCases} />,
    plans: content.showPlans ? <PlansTeaser plans={plans} profile={profile} /> : null,
    diagnostic: <DiagnosticTeaser />,
    poles: <PolesSection categories={categories} />,
    method: <MethodSection />,
    projects: <ProjectsSection projects={projects} />,
    testimonials: <TestimonialsSection testimonials={testimonials} />,
    stats: <StatsSection stats={settings?.stats ?? []} />,
    faq: <FaqSection faqs={faqs} />,
  };

  return (
    <>
      <Hero
        tagline={settings?.brand.tagline ?? ''}
        content={content}
        contentKey={profile ?? 'generic'}
      />
      <LayoutGroup>
        {sectionOrder[profile ?? 'generic']!.map((key) =>
          sections[key] ? (
            <motion.div
              key={key}
              layout="position"
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {sections[key]}
            </motion.div>
          ) : null,
        )}
      </LayoutGroup>
      <FinalCta content={content} />
    </>
  );
}
