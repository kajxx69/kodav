import { PageHero } from '~/components/site/PageHero';
import { Section } from '~/components/site/Section';
import { ErrorState, Skeleton } from '~/components/ui';
import { AssessmentWizard } from '~/features/assessment/AssessmentWizard';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import { useHydrated } from '~/lib/useHydrated';
import type { Route } from './+types/bilan-informatique';

export const loader = () => fetchAtBuild(queries.categories());
export const clientLoader = () => fetchInBrowser(queries.categories());

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Bilan de santé informatique gratuit',
    description:
      'Douze questions pour évaluer les sauvegardes, la sécurité et la fiabilité de l’informatique de votre PME ou de votre école à Abidjan. Score sur 100 et recommandations.',
    path: '/bilan-informatique',
  });
}

export default function AssessmentPage({ loaderData }: Route.ComponentProps) {
  const { data: catalog, isError, refetch } = useLiveQuery(queries.categories(), loaderData);
  const hydrated = useHydrated();
  return (
    <>
      <PageHero
        overline="Bilan de santé informatique"
        title="Votre informatique est-elle prête à encaisser un incident ?"
        lead="Douze questions, environ trois minutes : sauvegardes, antivirus, licences, mots de passe, Wi-Fi, onduleurs. Vous obtenez un score sur 100 et vos points d’amélioration."
        crumbs={[{ label: 'Bilan de santé informatique' }]}
      />
      <Section>
        {isError && !catalog ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : catalog && hydrated ? (
          <AssessmentWizard services={catalog.flatMap((c) => c.services)} />
        ) : (
          <div className="mx-auto grid max-w-3xl gap-4" role="status" aria-label="Chargement">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </Section>
    </>
  );
}
