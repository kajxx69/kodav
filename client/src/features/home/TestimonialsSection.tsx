import { Quote, Star } from 'lucide-react';
import type { Testimonial } from '@kodav/shared';
import { Reveal } from '~/components/site/Reveal';
import { Section, SectionHeader } from '~/components/site/Section';

/** Témoignages validés par l'équipe ; section masquée tant qu'il n'y en a aucun. */
export function TestimonialsSection({ testimonials }: { testimonials: Testimonial[] }) {
  if (testimonials.length === 0) return null;
  return (
    <Section sunken>
      <SectionHeader overline="Témoignages" title="Ce que disent nos clients" />
      <ul className="grid gap-6 md:grid-cols-3">
        {testimonials.slice(0, 6).map((t, i) => (
          <Reveal key={t.id} delay={i * 0.05}>
            <li className="flex h-full flex-col gap-4 rounded-lg border border-line bg-surface-raised p-6 shadow-sm">
              <Quote className="size-6 text-gold" aria-hidden />
              <blockquote className="flex-1 text-body text-ink">{t.content}</blockquote>
              <div className="flex items-center justify-between gap-3">
                <p className="text-body-sm">
                  <span className="block text-label">{t.authorName}</span>
                  <span className="text-ink-muted">
                    {[t.role, t.company].filter(Boolean).join(', ')}
                  </span>
                </p>
                <p className="flex" aria-label={`Note : ${t.rating} sur 5`}>
                  {Array.from({ length: 5 }, (_, s) => (
                    <Star
                      key={s}
                      className={s < t.rating ? 'size-4 fill-gold text-gold' : 'size-4 text-line'}
                      aria-hidden
                    />
                  ))}
                </p>
              </div>
            </li>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
