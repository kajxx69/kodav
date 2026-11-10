import { FolderOpen } from 'lucide-react';
import { Link } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { ProjectCard } from '~/components/site/ProjectCard';
import { Section } from '~/components/site/Section';
import { Button, CardGridSkeleton, EmptyState, ErrorState } from '~/components/ui';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import type { Route } from './+types/realisations';

export const loader = () => fetchAtBuild(queries.projects());
export const clientLoader = () => fetchInBrowser(queries.projects());

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Réalisations',
    description:
      'Projets informatiques réalisés : sites web, réseaux, salles informatiques et logiciels.',
    path: '/realisations',
  });
}

export default function Projects({ loaderData }: Route.ComponentProps) {
  const { data: projects, isError, refetch } = useLiveQuery(queries.projects(), loaderData);
  return (
    <>
      <PageHero
        overline="Réalisations"
        title="Nos réalisations"
        crumbs={[{ label: 'Réalisations' }]}
      />
      <Section>
        {isError && !projects && <ErrorState onRetry={() => void refetch()} />}
        {!projects && !isError && <CardGridSkeleton />}
        {projects?.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="Nos premières réalisations arrivent"
            description="Nous publions nos projets uniquement avec l’accord de nos clients. En attendant, parlons du vôtre."
            action={
              <Button asChild variant="secondary">
                <Link to="/contact">Nous contacter</Link>
              </Button>
            }
          />
        )}
        {projects && projects.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
