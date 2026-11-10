import { PageHero } from '~/components/site/PageHero';
import { Section } from '~/components/site/Section';
import { ErrorState, Skeleton } from '~/components/ui';
import { DiagnosticWizard } from '~/features/diagnostic/DiagnosticWizard';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import { useHydrated } from '~/lib/useHydrated';
import type { Route } from './+types/diagnostic';

export const loader = () => fetchAtBuild(queries.categories());
export const clientLoader = () => fetchInBrowser(queries.categories());

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Diagnostic express',
    description:
      'Cinq questions pour identifier les services informatiques adaptés à votre situation, avec une demande de devis pré-remplie.',
    path: '/diagnostic',
  });
}

export default function DiagnosticPage({ loaderData }: Route.ComponentProps) {
  const { data: catalog, isError, refetch } = useLiveQuery(queries.categories(), loaderData);
  const hydrated = useHydrated();
  return (
    <>
      <PageHero
        overline="Diagnostic express"
        title="Trouvons ensemble la bonne solution"
        lead="Cinq questions, moins d’une minute : nous vous recommandons les services adaptés et préparons votre demande de devis."
        crumbs={[{ label: 'Diagnostic express' }]}
      />
      <Section>
        {isError && !catalog ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : catalog && hydrated ? (
          <DiagnosticWizard services={catalog.flatMap((c) => c.services)} />
        ) : (
          <div className="mx-auto grid max-w-3xl gap-4" role="status" aria-label="Chargement">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </Section>
    </>
  );
}
