import { Check, Minus } from 'lucide-react';
import { formatFcfa, planCoversSeats, planMonthlyPrice, type MaintenancePlan } from '@kodav/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { Section, SectionHeader } from '~/components/site/Section';
import { Badge, Button, Card, CardGridSkeleton, ErrorState } from '~/components/ui';
import { cn } from '~/lib/cn';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import type { Route } from './+types/contrats-maintenance';

export const loader = () => fetchAtBuild(queries.plans());
export const clientLoader = () => fetchInBrowser(queries.plans());

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Contrats de maintenance informatique à Abidjan',
    description:
      'Trois formules de maintenance informatique mensuelle ou annuelle pour PME, écoles et entreprises à Abidjan : support, interventions et délais garantis.',
    path: '/contrats-maintenance',
  });
}

type Cycle = 'mensuel' | 'annuel';

const MAX_SIMULATED_SEATS = 150;

function seatRange(plan: MaintenancePlan) {
  return plan.maxSeats
    ? `${plan.minSeats} à ${plan.maxSeats} postes`
    : `Dès ${plan.minSeats} postes`;
}

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto size-5 text-success" aria-label="Inclus" />;
  if (value === false)
    return <Minus className="mx-auto size-5 text-ink-muted" aria-label="Non inclus" />;
  return <span>{value}</span>;
}

export default function MaintenanceContracts({ loaderData }: Route.ComponentProps) {
  const { data: plans, isError, refetch } = useLiveQuery(queries.plans(), loaderData);
  const [cycle, setCycle] = useState<Cycle>('mensuel');
  const [seats, setSeats] = useState(10);
  const fitting = plans?.find((p) => planCoversSeats(p, seats));
  const maxDiscount = Math.max(0, ...(plans ?? []).map((p) => p.annualDiscountPercent));
  const featureRows = plans?.[plans.length - 1]?.features ?? [];

  return (
    <>
      <PageHero
        overline="Contrats de maintenance"
        title="Votre parc entretenu, vos délais garantis"
        lead="Un forfait mensuel ou annuel, un interlocuteur unique, des délais d’intervention écrits dans le contrat."
        crumbs={[{ label: 'Contrats de maintenance' }]}
      />
      <Section>
        <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader title="Choisissez votre formule" />
          <div
            role="radiogroup"
            aria-label="Facturation"
            className="inline-flex rounded-full bg-surface-sunken p-1"
          >
            {(['mensuel', 'annuel'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={cycle === value}
                onClick={() => setCycle(value)}
                className={cn(
                  'rounded-full px-4 py-2 text-label transition-colors',
                  cycle === value
                    ? 'bg-surface-raised text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {value === 'mensuel' ? 'Mensuel' : 'Annuel'}
                {value === 'annuel' && maxDiscount > 0 && (
                  <span className="ml-2 text-caption text-success">jusqu’à −{maxDiscount} %</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8 flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-5 sm:flex-row sm:items-center sm:gap-6">
          <label htmlFor="seats-range" className="text-label text-ink sm:w-48">
            Nombre de postes à couvrir
          </label>
          <input
            id="seats-range"
            type="range"
            min={1}
            max={MAX_SIMULATED_SEATS}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="flex-1 accent-[var(--color-secondary)]"
            aria-valuetext={`${seats} postes`}
          />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={seats}
            onChange={(e) => setSeats(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))}
            aria-label="Nombre de postes"
            className="h-11 w-24 rounded-md border border-field-border bg-surface px-3 text-body tabular-nums"
          />
        </div>

        {isError && !plans && <ErrorState onRetry={() => void refetch()} />}
        {!plans && !isError && <CardGridSkeleton />}
        {plans && (
          <>
            <ul className="grid gap-6 md:grid-cols-3">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <Card
                    className={cn(
                      'flex h-full flex-col gap-4',
                      plan === fitting
                        ? 'border-secondary ring-1 ring-secondary'
                        : plan.highlighted && !fitting && 'border-gold ring-1 ring-gold',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-h3">{plan.name}</h3>
                      {plan === fitting ? (
                        <Badge variant="info">Adaptée à {seats} postes</Badge>
                      ) : (
                        plan.highlighted && <Badge variant="gold">Recommandée</Badge>
                      )}
                    </div>
                    <p className="text-body-sm text-ink-muted">{plan.tagline}</p>
                    {planCoversSeats(plan, seats) ? (
                      <div aria-live="polite">
                        <p>
                          <span className="font-display text-h2 text-gold-ink">
                            {formatFcfa(planMonthlyPrice(plan, seats, cycle))}
                          </span>
                          <span className="text-caption text-ink-muted"> / mois</span>
                        </p>
                        <p className="text-caption text-ink-muted">
                          Pour {seats} poste{seats > 1 ? 's' : ''}
                          {cycle === 'annuel' &&
                            `, soit ${formatFcfa(planMonthlyPrice(plan, seats, cycle) * 12)} par an`}
                        </p>
                      </div>
                    ) : (
                      <div aria-live="polite">
                        <p>
                          <span className="text-caption text-ink-muted">À partir de </span>
                          <span className="font-display text-h2 text-ink-muted">
                            {formatFcfa(planMonthlyPrice(plan, plan.minSeats, cycle))}
                          </span>
                          <span className="text-caption text-ink-muted"> / mois</span>
                        </p>
                        <p className="text-caption text-ink-muted">
                          Non adaptée à {seats} poste{seats > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                    <p className="text-caption text-ink-muted">
                      {seatRange(plan)} · {formatFcfa(plan.basePriceMonthly)} de forfait +{' '}
                      {formatFcfa(plan.pricePerSeatMonthly)} par poste et par mois
                    </p>
                    <Button
                      asChild
                      variant={
                        plan === (fitting ?? plans.find((p) => p.highlighted))
                          ? 'secondary'
                          : 'outline'
                      }
                      className="mt-auto"
                    >
                      <Link to={`/devis?formule=${plan.slug}&postes=${seats}`}>
                        Choisir {plan.name}
                      </Link>
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>

            <div className="mt-12 overflow-x-auto rounded-lg border border-line bg-surface-raised">
              <table className="w-full min-w-[40rem] text-body-sm">
                <caption className="sr-only">Comparatif des formules de maintenance</caption>
                <thead className="bg-surface-sunken">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-label text-ink-muted">
                      Inclus
                    </th>
                    {plans.map((plan) => (
                      <th key={plan.id} scope="col" className="px-4 py-3 text-center text-label">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featureRows.map((row) => (
                    <tr key={row.key} className="border-t border-line">
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        {row.label}
                      </th>
                      {plans.map((plan) => (
                        <td key={plan.id} className="px-4 py-3 text-center">
                          <FeatureValue
                            value={plan.features.find((f) => f.key === row.key)?.value ?? false}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-line">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      Délai d’intervention, urgence critique
                    </th>
                    {plans.map((plan) => (
                      <td key={plan.id} className="px-4 py-3 text-center">
                        {plan.sla.critique} h ouvrées
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-line">
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      Délai d’intervention, priorité haute
                    </th>
                    {plans.map((plan) => (
                      <td key={plan.id} className="px-4 py-3 text-center">
                        {plan.sla.haute} h ouvrées
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-caption text-ink-muted">
              Tarifs et délais indicatifs, précisés dans le contrat selon la taille et l’état de
              votre parc.
            </p>
          </>
        )}
      </Section>
    </>
  );
}
