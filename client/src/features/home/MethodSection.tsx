import { Reveal } from '~/components/site/Reveal';
import { Section, SectionHeader } from '~/components/site/Section';
import { methodSteps } from '~/content/profiles';

export function MethodSection() {
  return (
    <Section sunken>
      <SectionHeader overline="Notre méthode" title="Quatre étapes, aucune surprise" />
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {methodSteps.map((step, i) => (
          <Reveal key={step.title} delay={i * 0.08}>
            <li className="flex h-full flex-col gap-3">
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full border-[3px] border-gold bg-navy font-display text-label text-on-band">
                  {i + 1}
                </span>
                {i < methodSteps.length - 1 && (
                  <span className="hidden h-0.5 flex-1 bg-line lg:block" aria-hidden />
                )}
              </span>
              <h3 className="text-h4">{step.title}</h3>
              <p className="text-body-sm text-ink-muted">{step.description}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
