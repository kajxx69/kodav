import { CalendarClock, Clock, MapPin, Users } from 'lucide-react';
import { INTERVENTION_MODE_LABELS, PROFILE_META, formatFcfa, type Service } from '@kodav/shared';
import { Link } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { RichText } from '~/components/site/RichText';
import { Section, SectionHeader } from '~/components/site/Section';
import { ServiceCard } from '~/components/site/ServiceCard';
import { Badge, Button, Card, ErrorState, Skeleton } from '~/components/ui';
import { durationLabel, priceLabel } from '~/lib/format';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { SITE_URL, brandFromMatches, pageMeta } from '~/lib/seo';
import type { Route } from './+types/services.detail';

/** Le service et son pôle (« Dans le même pôle »), au build comme dans le navigateur. */
async function loadServicePage(
  fetch: typeof fetchAtBuild,
  params: { pole: string; service: string },
) {
  const [service, category] = await Promise.all([
    fetch(queries.service(params.pole, params.service)),
    fetch(queries.category(params.pole)),
  ]);
  return { service, category };
}

export const loader = ({ params }: Route.LoaderArgs) => loadServicePage(fetchAtBuild, params);
export const clientLoader = ({ params }: Route.ClientLoaderArgs) =>
  loadServicePage(fetchInBrowser, params);

export function meta({ matches, loaderData, params }: Route.MetaArgs) {
  const service = loaderData?.service;
  const brand = brandFromMatches(matches);
  const path = `/services/${params.pole}/${params.service}`;
  return pageMeta(matches, {
    title: service?.seo.title ?? service?.name ?? 'Service',
    description: service?.seo.description ?? service?.shortDescription ?? '',
    path,
    jsonLd: service
      ? {
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: service.name,
          description: service.shortDescription,
          serviceType: service.category.name,
          areaServed: { '@type': 'City', name: 'Abidjan' },
          url: `${SITE_URL}${path}`,
          ...(brand ? { provider: { '@type': 'LocalBusiness', name: brand.legalName } } : {}),
          ...(service.priceMin !== undefined
            ? {
                offers: {
                  '@type': 'Offer',
                  priceCurrency: 'XOF',
                  price: service.priceMin,
                  priceSpecification: {
                    '@type': 'PriceSpecification',
                    priceCurrency: 'XOF',
                    minPrice: service.priceMin,
                    ...(service.priceMax ? { maxPrice: service.priceMax } : {}),
                  },
                },
              }
            : {}),
        }
      : undefined,
  });
}

function optionImpact(option: Service['options'][number]) {
  if (!option.impact) return null;
  const { kind, min } = option.impact;
  const suffix = option.perUnit ? ' par unité' : '';
  return kind === 'percent' ? `+${min} %${suffix}` : `+${formatFcfa(min)}${suffix}`;
}

export default function ServiceDetail({ loaderData, params }: Route.ComponentProps) {
  const {
    data: service,
    isError,
    refetch,
  } = useLiveQuery(queries.service(params.pole, params.service), loaderData.service);
  const { data: category } = useLiveQuery(queries.category(params.pole), loaderData.category);
  const related = category?.services.filter((s) => s.slug !== params.service).slice(0, 3) ?? [];

  if (!service) {
    return (
      <Section>
        {isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <div className="flex flex-col gap-4" role="status" aria-label="Chargement">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
          </div>
        )}
      </Section>
    );
  }

  const quoteHref = `/devis?service=${service.category.slug}/${service.slug}`;
  const facts = [
    { icon: Clock, label: 'Délai estimé', value: durationLabel(service.estimatedDuration) },
    {
      icon: MapPin,
      label: 'Intervention',
      value: service.modes.map((m) => INTERVENTION_MODE_LABELS[m]).join(', '),
    },
    {
      icon: Users,
      label: 'Pour',
      value: service.targetProfiles.map((p) => PROFILE_META[p].plural).join(', '),
    },
  ];

  return (
    <>
      <PageHero
        overline={service.category.name}
        title={service.name}
        lead={service.shortDescription}
        crumbs={[
          { label: 'Services', to: '/services' },
          { label: service.category.name, to: `/services/${service.category.slug}` },
          { label: service.name },
        ]}
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex flex-col gap-8">
            <RichText text={service.longDescription} className="text-body text-ink" />
            {service.options.length > 0 && (
              <div>
                <h2 className="mb-3 text-h4">Options disponibles</h2>
                <ul className="divide-y divide-line rounded-lg border border-line bg-surface-raised">
                  {service.options.map((option) => (
                    <li
                      key={option.key}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-body-sm"
                    >
                      <span>{option.label}</span>
                      {optionImpact(option) && <Badge>{optionImpact(option)}</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="flex flex-col gap-5">
              <div>
                <p className="text-caption text-ink-muted">Tarif</p>
                <p className="font-display text-h3 text-gold-ink">{priceLabel(service)}</p>
                {service.pricingMode !== 'sur_devis' && (
                  <p className="mt-1 text-caption text-ink-muted">
                    Tarif indicatif, confirmé sur devis.
                  </p>
                )}
              </div>
              <dl className="flex flex-col gap-3 border-t border-line pt-4">
                {facts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex gap-3 text-body-sm">
                    <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
                    <div>
                      <dt className="text-caption text-ink-muted">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              <div className="flex flex-col gap-2">
                <Button asChild size="lg">
                  <Link to={quoteHref}>Obtenir mon devis</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`/rendez-vous?service=${service.category.slug}/${service.slug}`}>
                    <CalendarClock aria-hidden />
                    Réserver une intervention
                  </Link>
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      </Section>
      {related.length > 0 && (
        <Section sunken>
          <SectionHeader overline={service.category.name} title="Dans le même pôle" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
