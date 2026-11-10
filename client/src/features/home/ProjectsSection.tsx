import type { Project } from '@kodav/shared';
import { Link } from 'react-router';
import { Reveal } from '~/components/site/Reveal';
import { Section, SectionHeader } from '~/components/site/Section';
import { ProjectCard } from '~/components/site/ProjectCard';
import { Button } from '~/components/ui';

/** Masquée tant qu'aucune réalisation n'est publiée depuis l'admin. */
export function ProjectsSection({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null;
  return (
    <Section>
      <SectionHeader
        overline="Réalisations"
        title="Quelques projets récents"
        action={
          <Button asChild variant="outline">
            <Link to="/realisations">Toutes les réalisations</Link>
          </Button>
        }
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.slice(0, 3).map((project, i) => (
          <Reveal key={project.id} delay={i * 0.05}>
            <ProjectCard project={project} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
