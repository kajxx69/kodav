import { Link } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { Section, SectionHeader } from '~/components/site/Section';
import { ServiceCard } from '~/components/site/ServiceCard';
import { Button, CardGridSkeleton, ErrorState } from '~/components/ui';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import type { Route } from './+types/services.pole';

export const loader = ({ params }: Route.LoaderArgs) => fetchAtBuild(queries.category(params.pole));
export const clientLoader = ({ params }: Route.ClientLoaderArgs) =>
  fetchInBrowser(queries.category(params.pole));

export function meta({ matches, loaderData, params }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: loaderData?.seo.title ?? loaderData?.name ?? 'Services',
    description: loaderData?.seo.description ?? loaderData?.shortDescription ?? '',
    path: `/services/${params.pole}`,
  });
}

export default function ServicePole({ loaderData, params }: Route.ComponentProps) {
  const {
    data: category,
    isError,
    refetch,
  } = useLiveQuery(queries.category(params.pole), loaderData);

  if (!category) {
    return (
      <Section>
        {isError ? <ErrorState onRetry={() => void refetch()} /> : <CardGridSkeleton />}
      </Section>
    );
  }

  return (
    <>
      <PageHero
        overline="Pôle"
        title={category.name}
        lead={category.description}
        crumbs={[{ label: 'Services', to: '/services' }, { label: category.name }]}
      />
      <Section>
        <SectionHeader title={`${category.services.length} services`} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {category.services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </Section>
      <Section sunken>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-h3">Un besoin qui ne rentre dans aucune case ?</h2>
            <p className="text-body text-ink-muted">
              Décrivez-le-nous : nous vous proposons une solution sur mesure.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/devis">Demander un devis</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/contact">Nous contacter</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
