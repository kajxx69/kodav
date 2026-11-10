import { PageHero } from '~/components/site/PageHero';
import { RichText } from '~/components/site/RichText';
import { Section } from '~/components/site/Section';
import { Badge, ErrorState, Skeleton } from '~/components/ui';
import { fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import type { Route } from './+types/realisations.detail';

// Chargée dans le navigateur : le pré-rendu des réalisations arrivera quand il y en aura (phase 7).
export const clientLoader = ({ params }: Route.ClientLoaderArgs) =>
  fetchInBrowser(queries.project(params.slug));

export function meta({ matches, loaderData, params }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: loaderData?.title ?? 'Réalisation',
    description: loaderData?.summary ?? '',
    path: `/realisations/${params.slug}`,
  });
}

export default function ProjectDetail({ loaderData, params }: Route.ComponentProps) {
  const {
    data: project,
    isError,
    refetch,
  } = useLiveQuery(queries.project(params.slug), loaderData);
  if (!project) {
    return (
      <Section>
        {isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </Section>
    );
  }
  return (
    <>
      <PageHero
        overline={project.category}
        title={project.title}
        lead={project.summary}
        crumbs={[{ label: 'Réalisations', to: '/realisations' }, { label: project.title }]}
      />
      <Section>
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {project.client && (
            <p className="text-body-sm text-ink-muted">Client : {project.client}</p>
          )}
          {project.images.map((image) => (
            <img
              key={image.url}
              src={image.url}
              alt={image.alt}
              loading="lazy"
              className="rounded-lg"
            />
          ))}
          <RichText text={project.content} />
          {project.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <li key={tag}>
                  <Badge>{tag}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>
    </>
  );
}
