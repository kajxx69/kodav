import { ArrowRight } from 'lucide-react';
import type { Service } from '@kodav/shared';
import { Link } from 'react-router';
import { Badge, Card } from '~/components/ui';
import { cn } from '~/lib/cn';
import { durationLabel, priceLabel } from '~/lib/format';

/** Carte de service : nom, accroche, prix « à partir de » ou « sur devis », délai. */
export function ServiceCard({ service, className }: { service: Service; className?: string }) {
  const href = `/services/${service.category.slug}/${service.slug}`;
  return (
    <Card interactive className={cn('group relative flex h-full flex-col gap-3', className)}>
      <div className="flex items-center gap-2">
        <Badge>{service.category.name}</Badge>
        {service.featured && <Badge variant="gold">Recommandé</Badge>}
      </div>
      <h3 className="text-h4">
        {/* Toute la carte est cliquable, sans imbriquer de contenu interactif. */}
        <Link to={href} className="after:absolute after:inset-0 after:rounded-lg">
          {service.name}
        </Link>
      </h3>
      <p className="flex-1 text-body-sm text-ink-muted">{service.shortDescription}</p>
      <div className="flex items-end justify-between gap-3 border-t border-line pt-3">
        <div>
          <p className="text-label text-gold-ink">{priceLabel(service)}</p>
          <p className="text-caption text-ink-muted">
            Délai : {durationLabel(service.estimatedDuration)}
          </p>
        </div>
        <ArrowRight
          className="size-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-ink motion-reduce:transition-none"
          aria-hidden
        />
      </div>
    </Card>
  );
}
