import { useSearchParams } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { Section } from '~/components/site/Section';
import { ErrorState, Skeleton } from '~/components/ui';
import { BookingForm } from '~/features/appointments/BookingForm';
import { NextSlotBadge } from '~/features/appointments/SlotPicker';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import { useHydrated } from '~/lib/useHydrated';
import type { Route } from './+types/rendez-vous';

export const loader = () => fetchAtBuild(queries.categories());
export const clientLoader = () => fetchInBrowser(queries.categories());

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Prendre rendez-vous',
    description:
      'Réservez en ligne une intervention informatique à Abidjan : sur site, à distance ou en atelier, sur un créneau libre de notre planning.',
    path: '/rendez-vous',
  });
}

export default function AppointmentPage({ loaderData }: Route.ComponentProps) {
  const { data: catalog, isError, refetch } = useLiveQuery(queries.categories(), loaderData);
  const hydrated = useHydrated();
  const [params] = useSearchParams();
  const services = catalog?.flatMap((c) => c.services) ?? [];
  // ?service=pole/slug depuis une fiche service ; ?devis=<id> après acceptation d'un devis.
  const [pole, slug] = (params.get('service') ?? '').split('/');
  const initialServiceId = services.find((s) => s.category.slug === pole && s.slug === slug)?.id;
  const quoteId = /^[a-f\d]{24}$/i.test(params.get('devis') ?? '')
    ? params.get('devis')!
    : undefined;

  return (
    <>
      <PageHero
        overline="Rendez-vous"
        title="Prendre rendez-vous"
        lead="Choisissez un créneau libre de notre planning : sur site, à distance ou en atelier. Vous recevez une confirmation et un rappel la veille."
        crumbs={[{ label: 'Rendez-vous' }]}
      >
        {hydrated && <NextSlotBadge onBand className="mt-2" />}
      </PageHero>
      <Section>
        {isError && !catalog ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : catalog && hydrated ? (
          <BookingForm
            key={`${initialServiceId ?? ''}-${quoteId ?? ''}`}
            services={services}
            initialServiceId={initialServiceId}
            quoteId={quoteId}
          />
        ) : (
          <div className="mx-auto grid max-w-3xl gap-4" role="status" aria-label="Chargement">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </Section>
    </>
  );
}
