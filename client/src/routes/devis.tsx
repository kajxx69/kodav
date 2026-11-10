import { PageHero } from '~/components/site/PageHero';
import { Section } from '~/components/site/Section';
import { ErrorState, Skeleton } from '~/components/ui';
import { Configurator } from '~/features/quote/Configurator';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import { useHydrated } from '~/lib/useHydrated';
import type { Route } from './+types/devis';

export const loader = () => fetchAtBuild(queries.categories());
export const clientLoader = () => fetchInBrowser(queries.categories());

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Demander un devis en ligne',
    description:
      'Composez votre demande en quelques étapes et obtenez une estimation immédiate : dépannage, réseau, logiciels, sites web et maintenance à Abidjan.',
    path: '/devis',
  });
}

export default function QuotePage({ loaderData }: Route.ComponentProps) {
  const { data: catalog, isError, refetch } = useLiveQuery(queries.categories(), loaderData);
  // Le configurateur lit le brouillon du navigateur : affiché après l'hydratation.
  const hydrated = useHydrated();
  return (
    <>
      <PageHero
        overline="Devis"
        title="Demander un devis"
        lead="Choisissez vos services, précisez votre besoin : l’estimation se met à jour à chaque choix. Votre sélection est sauvegardée automatiquement."
        crumbs={[{ label: 'Devis' }]}
      />
      <Section>
        {isError && !catalog ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : catalog && hydrated ? (
          <Configurator catalog={catalog} />
        ) : (
          <div className="grid gap-4" role="status" aria-label="Chargement du configurateur">
            <Skeleton className="h-10 w-full max-w-xl" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </Section>
    </>
  );
}
