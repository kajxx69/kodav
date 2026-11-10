import { Stethoscope } from 'lucide-react';
import { Link } from 'react-router';
import { Reveal } from '~/components/site/Reveal';
import { Section } from '~/components/site/Section';
import { Button } from '~/components/ui';

export function DiagnosticTeaser() {
  return (
    <Section>
      <Reveal>
        <div className="flex flex-col gap-6 rounded-xl border border-line bg-gold-soft p-6 sm:flex-row sm:items-center sm:p-10">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-navy text-gold">
            <Stethoscope className="size-7" aria-hidden />
          </span>
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-overline text-gold-ink">Diagnostic express</p>
            <h2 className="text-h3">Vous ne savez pas par où commencer ?</h2>
            <p className="text-body text-ink-muted">
              Répondez à quelques questions : nous vous recommandons les services adaptés et
              préparons votre demande de devis.
            </p>
          </div>
          <Button asChild variant="secondary" size="lg">
            <Link to="/diagnostic">Lancer le diagnostic</Link>
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}
