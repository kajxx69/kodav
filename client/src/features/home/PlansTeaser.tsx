import { Check } from 'lucide-react';
import { formatFcfa, type ClientProfile, type MaintenancePlan } from '@kodav/shared';
import { Link } from 'react-router';
import { Reveal } from '~/components/site/Reveal';
import { Section, SectionHeader } from '~/components/site/Section';
import { Badge, Button, Card } from '~/components/ui';
import { cn } from '~/lib/cn';

/** Formule conseillée : celle qui cible le profil, sinon celle mise en avant. */
export function recommendedPlan(plans: MaintenancePlan[], profile: ClientProfile | null) {
  if (profile === 'ecole') return plans.find((p) => p.slug === 'etablissement') ?? null;
  return (
    plans.find((p) => p.highlighted && (!profile || p.targetProfiles.includes(profile))) ??
    plans.find((p) => profile && p.targetProfiles.includes(profile)) ??
    null
  );
}

export function PlansTeaser({
  plans,
  profile,
}: {
  plans: MaintenancePlan[];
  profile: ClientProfile | null;
}) {
  if (plans.length === 0) return null;
  const recommended = recommendedPlan(plans, profile);
  return (
    <Section>
      <SectionHeader
        overline="Contrats de maintenance"
        title="Un forfait mensuel, des délais garantis"
        lead="Support à distance, interventions sur site et visites préventives selon la formule."
        action={
          <Button asChild variant="outline">
            <Link to="/contrats-maintenance">Comparer les formules</Link>
          </Button>
        }
      />
      <ul className="grid gap-6 md:grid-cols-3">
        {plans.map((plan, i) => {
          const isRecommended = plan.id === recommended?.id;
          return (
            <Reveal key={plan.id} delay={i * 0.05}>
              <li className="h-full">
                <Card
                  className={cn(
                    'flex h-full flex-col gap-4',
                    isRecommended && 'border-gold ring-1 ring-gold',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-h4">{plan.name}</h3>
                    {isRecommended && <Badge variant="gold">Conseillée pour vous</Badge>}
                  </div>
                  <p className="text-body-sm text-ink-muted">{plan.tagline}</p>
                  <p>
                    <span className="text-caption text-ink-muted">À partir de </span>
                    <span className="font-display text-h4 text-gold-ink">
                      {formatFcfa(plan.basePriceMonthly + plan.pricePerSeatMonthly * plan.minSeats)}
                    </span>
                    <span className="text-caption text-ink-muted"> / mois</span>
                  </p>
                  <ul className="flex flex-col gap-2 border-t border-line pt-4">
                    {plan.features
                      .filter((f) => f.value !== false)
                      .slice(0, 4)
                      .map((f) => (
                        <li key={f.key} className="flex gap-2 text-body-sm">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                          <span>
                            {f.label}
                            {typeof f.value === 'string' && (
                              <span className="text-ink-muted"> : {f.value.toLowerCase()}</span>
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                </Card>
              </li>
            </Reveal>
          );
        })}
      </ul>
      <p className="mt-4 text-caption text-ink-muted">
        Tarifs indicatifs, ajustés selon la taille de votre parc.
      </p>
    </Section>
  );
}
