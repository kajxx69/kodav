import type { Estimate } from '@kodav/shared';
import { ChevronUp, Info } from 'lucide-react';
import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Skeleton } from '~/components/ui';
import { cn } from '~/lib/cn';
import { durationLabel, plural, rangeLabel } from '~/lib/format';

const numberFormat = new Intl.NumberFormat('fr-FR');

/** Montant qui glisse vers sa nouvelle valeur à chaque recalcul. */
function AnimatedAmount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    const from = previous.current;
    previous.current = value;
    if (!el || reduced || from === value) {
      if (el) el.textContent = numberFormat.format(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.5,
      ease: 'easeOut',
      onUpdate: (v) => {
        el.textContent = numberFormat.format(Math.round(v / 500) * 500);
      },
    });
    return () => controls.stop();
  }, [value, reduced]);
  return <span ref={ref}>{numberFormat.format(value)}</span>;
}

function TotalRange({ estimate, className }: { estimate: Estimate; className?: string }) {
  const { min, max } = estimate.total;
  return (
    <span className={cn('tabular-nums', className)}>
      <AnimatedAmount value={min} />
      {min !== max && (
        <>
          {' – '}
          <AnimatedAmount value={max} />
        </>
      )}{' '}
      FCFA
    </span>
  );
}

function Row({ label, value, muted }: { label: ReactNode; value: ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-body-sm">
      <dt className={muted ? 'text-ink-muted' : 'text-ink'}>{label}</dt>
      <dd className="shrink-0 text-right text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function Details({ estimate }: { estimate: Estimate }) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-3">
        {estimate.lines.map((line) => (
          <Row
            key={line.serviceId}
            label={
              <>
                <span className="block">{line.name}</span>
                <span className="block text-caption text-ink-muted">
                  {line.pricingMode === 'par_unite'
                    ? `${line.quantity} ${plural(line.unitLabel, line.quantity)}`
                    : 'Forfait'}
                  {line.options.length > 0 &&
                    ` · ${line.options.map((o) => (o.value === 'Oui' ? o.label : `${o.label} : ${o.value}`)).join(', ')}`}
                  {line.volumeDiscountPercent > 0 && ` · remise ${line.volumeDiscountPercent} %`}
                </span>
              </>
            }
            value={line.onQuote ? 'Sur devis' : rangeLabel(line.total)}
          />
        ))}
      </dl>
      <dl className="flex flex-col gap-2 border-t border-line pt-3">
        {estimate.volumeDiscount.max > 0 && (
          <Row muted label="Remise volume" value={`- ${rangeLabel(estimate.volumeDiscount)}`} />
        )}
        {estimate.urgency.percent > 0 && (
          <Row
            muted
            label={`Urgence (${estimate.urgency.label.toLowerCase()}, +${estimate.urgency.percent} %)`}
            value={rangeLabel(estimate.urgency.amount)}
          />
        )}
        {estimate.travel.status === 'included' && (
          <Row
            muted
            label={`Déplacement (${estimate.travel.commune})`}
            value={rangeLabel({ min: estimate.travel.fee, max: estimate.travel.fee })}
          />
        )}
        {estimate.travel.status === 'on_quote' && (
          <Row muted label="Déplacement hors Abidjan" value="Sur devis" />
        )}
        {estimate.travel.status === 'pending' && (
          <Row muted label="Déplacement" value="Selon la commune" />
        )}
      </dl>
    </div>
  );
}

function Notes({ estimate }: { estimate: Estimate }) {
  return (
    <ul className="flex flex-col gap-1.5 text-caption text-ink-muted">
      {estimate.duration && (
        <li>Délai de réalisation estimé : {durationLabel(estimate.duration)}.</li>
      )}
      {estimate.hasOnQuoteItems && (
        <li>Les prestations « sur devis » sont chiffrées après un échange avec vous.</li>
      )}
      <li className="flex gap-1.5">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        Estimation indicative, confirmée par un devis définitif
        {estimate.isPlaceholderPrice ? ' (tarifs d’exemple)' : ''}.
      </li>
    </ul>
  );
}

type SummaryProps = {
  estimate: Estimate | undefined;
  loading: boolean;
  error: string | null;
  empty: boolean;
};

function Total({ estimate, loading }: Pick<SummaryProps, 'estimate' | 'loading'>) {
  if (!estimate) return loading ? <Skeleton className="h-8 w-48" /> : <span>—</span>;
  const onlyOnQuote = estimate.lines.length > 0 && estimate.lines.every((l) => l.onQuote);
  return onlyOnQuote ? (
    <span>Sur devis</span>
  ) : (
    <TotalRange estimate={estimate} className={loading ? 'opacity-60' : undefined} />
  );
}

/** Colonne de droite (desktop) : récapitulatif complet, toujours visible. */
export function EstimateAside({ estimate, loading, error, empty }: SummaryProps) {
  return (
    <aside
      aria-label="Estimation"
      className="sticky top-24 hidden flex-col gap-5 rounded-lg border border-line bg-surface-raised p-6 shadow-sm lg:flex"
    >
      <div>
        <p className="text-overline text-gold-ink">Estimation</p>
        <p className="mt-1 text-h3 text-ink" aria-live="polite">
          {empty ? 'Choisissez un service' : <Total estimate={estimate} loading={loading} />}
        </p>
      </div>
      {error && <p className="text-body-sm text-danger">{error}</p>}
      {estimate && !empty && (
        <>
          <Details estimate={estimate} />
          <Notes estimate={estimate} />
        </>
      )}
      {empty && (
        <p className="text-body-sm text-ink-muted">
          Le prix estimé s’affiche ici et se met à jour à chaque choix.
        </p>
      )}
    </aside>
  );
}

/** Barre fixe en bas d'écran (mobile) : total, et détail en dépliant. */
export function EstimateBar({ estimate, loading, error, empty }: SummaryProps) {
  const [open, setOpen] = useState(false);
  if (empty) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised shadow-lg pb-[env(safe-area-inset-bottom)] lg:hidden">
      {open && estimate && (
        <div
          id="estimation-detail"
          className="max-h-[55dvh] overflow-y-auto border-b border-line px-4 py-4"
        >
          <Details estimate={estimate} />
          <div className="mt-4">
            <Notes estimate={estimate} />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="estimation-detail"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-caption text-ink-muted">Estimation</span>
          <span className="block text-h4 text-ink" aria-live="polite">
            <Total estimate={estimate} loading={loading} />
          </span>
          {error && <span className="block text-caption text-danger">{error}</span>}
        </span>
        <span className="flex items-center gap-1 text-label text-link">
          {open ? 'Masquer' : 'Détail'}
          <ChevronUp
            className={cn('size-4 transition-transform', !open && 'rotate-180')}
            aria-hidden
          />
        </span>
      </button>
    </div>
  );
}
