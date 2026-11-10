import type { Stat } from '@kodav/shared';
import { Section } from '~/components/site/Section';
import { AnimatedCounter } from '~/components/site/AnimatedCounter';

/** Chiffres clés saisis dans l'admin ; masqués tant qu'il n'y en a aucun. */
export function StatsSection({ stats }: { stats: Stat[] }) {
  if (stats.length === 0) return null;
  return (
    <Section band className="py-10 sm:py-12">
      <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse gap-1 text-center">
            <dt className="text-body-sm text-on-band-muted">{stat.label}</dt>
            <dd className="font-display text-h1 text-on-band">
              <AnimatedCounter value={stat.value} />
              {stat.suffix && <span className="text-gold">{stat.suffix}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
