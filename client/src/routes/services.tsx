import { PageHero } from '~/components/site/PageHero';
import { PoleIcon } from '~/components/site/PoleIcon';
import { Section } from '~/components/site/Section';
import { ServiceCard } from '~/components/site/ServiceCard';
import { CardGridSkeleton, ErrorState } from '~/components/ui';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import { Link } from 'react-router';
import type { Route } from './+types/services';

export const loader = () => fetchAtBuild(queries.categories());
export const clientLoader = () => fetchInBrowser(queries.categories());

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Nos services informatiques à Abidjan',
    description:
      'Développement web et logiciel, réseaux et systèmes, logiciels professionnels, maintenance et support : tous nos services à Abidjan.',
    path: '/services',
  });
}

export default function Services({ loaderData }: Route.ComponentProps) {
  const { data: categories, isError, refetch } = useLiveQuery(queries.categories(), loaderData);
  return (
    <>
      <PageHero
        overline="Services"
        title="Tous nos services"
        lead="Quatre pôles d’expertise pour couvrir l’ensemble de vos besoins informatiques, du particulier à la grande entreprise."
        crumbs={[{ label: 'Services' }]}
      >
        {categories && (
          <nav aria-label="Pôles" className="mt-2 flex flex-wrap gap-2">
            {categories.map((c) => (
              <a
                key={c.slug}
                href={`#${c.slug}`}
                className="rounded-full border border-slate px-3 py-1 text-label text-on-band hover:bg-slate"
              >
                {c.name}
              </a>
            ))}
          </nav>
        )}
      </PageHero>
      {isError && !categories && (
        <Section>
          <ErrorState onRetry={() => void refetch()} />
        </Section>
      )}
      {!categories && !isError && (
        <Section>
          <CardGridSkeleton count={6} />
        </Section>
      )}
      {categories?.map((category, i) => (
        <Section
          key={category.slug}
          id={category.slug}
          sunken={i % 2 === 1}
          className="scroll-mt-16"
        >
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-navy text-gold">
                <PoleIcon name={category.icon} className="size-6" />
              </span>
              <div className="flex max-w-2xl flex-col gap-1">
                <h2 className="text-h2">{category.name}</h2>
                <p className="text-body text-ink-muted">{category.shortDescription}</p>
              </div>
            </div>
            <Link
              to={`/services/${category.slug}`}
              className="text-label text-link hover:underline"
            >
              Découvrir le pôle
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {category.services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
