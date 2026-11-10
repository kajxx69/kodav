import { ImageIcon } from 'lucide-react';
import type { Project } from '@kodav/shared';
import { Link } from 'react-router';
import { Badge, Card } from '~/components/ui';

export function ProjectCard({ project }: { project: Project }) {
  const cover = project.images[0];
  return (
    <Card interactive className="relative flex h-full flex-col overflow-hidden p-0">
      <div className="aspect-[16/10] bg-surface-sunken">
        {cover ? (
          <img src={cover.url} alt={cover.alt} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-ink-muted">
            <ImageIcon className="size-8" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        {project.category && <Badge className="self-start">{project.category}</Badge>}
        <h3 className="text-h4">
          <Link to={`/realisations/${project.slug}`} className="after:absolute after:inset-0">
            {project.title}
          </Link>
        </h3>
        <p className="text-body-sm text-ink-muted">{project.summary}</p>
      </div>
    </Card>
  );
}
