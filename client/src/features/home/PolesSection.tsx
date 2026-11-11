import { ArrowRight } from 'lucide-react';
import type { CategoryWithServices } from '@kodav/shared';
import { Link } from 'react-router';
import { PoleIcon } from '~/components/site/PoleIcon';
import { Reveal } from '~/components/site/Reveal';
import { Section, SectionHeader } from '~/components/site/Section';
import { CardGridSkeleton } from '~/components/ui';

export function PolesSection({ categories }: { categories: CategoryWithServices[] | undefined }) {
  return (
    <Section band>
      <SectionHeader
        band
        overline="Quatre pôles d’expertise"
        title="Toute votre informatique, un seul interlocuteur"
        lead="Du câble réseau au logiciel sur mesure, nous couvrons l’ensemble de vos besoins."
      />
      {categories ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {categories.map((category, i) => (
            <Reveal
              as="li"
              key={category.slug}
              delay={i * 0.05}
              className="group relative flex h-full gap-4 rounded-lg border border-slate bg-navy/40 p-6 transition-colors hover:border-gold/60 hover:bg-slate/40"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-slate text-gold">
                <PoleIcon name={category.icon} className="size-6" />
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-h4">
                  <Link
                    to={`/services/${category.slug}`}
                    className="after:absolute after:inset-0 after:rounded-lg"
                  >
                    {category.name}
                  </Link>
                </h3>
                <p className="text-body-sm text-on-band-muted">{category.shortDescription}</p>
                <p className="mt-auto inline-flex items-center gap-1 text-label text-gold">
                  {category.services.length} services
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      ) : (
        <CardGridSkeleton count={4} />
      )}
    </Section>
  );
}
