import { Reveal } from '~/components/site/Reveal';
import { Section, SectionHeader } from '~/components/site/Section';
import type { ProfileContent } from '~/content/profiles';

export function UseCases({ useCases }: { useCases: ProfileContent['useCases'] }) {
  return (
    <Section sunken>
      <SectionHeader overline="Cas d’usage" title="Ce que nous réglons au quotidien" />
      <ol className="grid gap-6 md:grid-cols-3">
        {useCases.map((useCase, i) => (
          <Reveal key={useCase.title} delay={i * 0.05}>
            <li className="flex h-full flex-col gap-2 rounded-lg border-l-2 border-gold bg-surface-raised p-6 shadow-sm">
              <h3 className="text-h4">{useCase.title}</h3>
              <p className="text-body-sm text-ink-muted">{useCase.description}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
