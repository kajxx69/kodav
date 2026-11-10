import {
  INTERVENTION_MODE_LABELS,
  QUOTE_STATUS_LABELS,
  formatCiPhone,
  formatFcfa,
  type QuoteDto,
  type QuoteStatus,
} from '@kodav/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Alert, Badge, Button, Card, Modal, StatusTimeline, TextArea } from '~/components/ui';
import { formatDate, formatDateTime, plural, rangeLabel } from '~/lib/format';

const STATUS_VARIANT: Record<
  QuoteStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'gold'
> = {
  brouillon: 'neutral',
  soumis: 'info',
  en_revue: 'info',
  envoye: 'gold',
  accepte: 'success',
  refuse: 'danger',
  expire: 'neutral',
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{QUOTE_STATUS_LABELS[status]}</Badge>;
}

/** Suivi : demande → étude → devis envoyé → décision (ou expiration). */
export function QuoteTimeline({ quote }: { quote: QuoteDto }) {
  const last = (status: QuoteStatus) => quote.statusHistory.findLast((h) => h.status === status);
  const outcome: QuoteStatus = ['accepte', 'refuse', 'expire'].includes(quote.status)
    ? quote.status
    : 'accepte';
  const steps = (['soumis', 'en_revue', 'envoye', outcome] as const).map((status) => {
    const entry = last(status);
    return {
      key: status,
      label:
        status === 'accepte' && quote.status !== 'accepte'
          ? 'Votre réponse'
          : QUOTE_STATUS_LABELS[status],
      date: entry ? formatDateTime(entry.at) : undefined,
    };
  });
  const order = ['soumis', 'en_revue', 'envoye'];
  const current = ['accepte', 'refuse', 'expire'].includes(quote.status)
    ? 3
    : order.indexOf(quote.status);
  return <StatusTimeline steps={steps} current={Math.max(current, 0)} />;
}

function Totals({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <dl className="ml-auto flex w-full max-w-sm flex-col gap-2">
      {rows.map(([label, value, strong]) => (
        <div
          key={label}
          className={
            strong
              ? 'flex justify-between gap-4 rounded-md bg-band px-3 py-2 text-label text-on-band'
              : 'flex justify-between gap-4 px-3 text-body-sm'
          }
        >
          <dt className={strong ? undefined : 'text-ink-muted'}>{label}</dt>
          <dd className="text-right tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Lignes et montants : définitifs une fois le devis envoyé, sinon l'estimation de la demande. */
export function QuoteLines({ quote }: { quote: QuoteDto }) {
  const final =
    quote.finalTotals && ['envoye', 'accepte', 'refuse', 'expire'].includes(quote.status);
  if (final) {
    const t = quote.finalTotals!;
    return (
      <div className="flex flex-col gap-4">
        <ul className="divide-y divide-line rounded-lg border border-line">
          {quote.finalItems.map((item, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-3 p-4">
              <div>
                <p className="text-label text-ink">{item.label}</p>
                {item.description && (
                  <p className="text-body-sm text-ink-muted">{item.description}</p>
                )}
                <p className="text-body-sm text-ink-muted">
                  {item.quantity} {plural(item.unitLabel, item.quantity)} ×{' '}
                  {formatFcfa(item.unitPrice)}
                </p>
              </div>
              <p className="text-label text-ink tabular-nums">{formatFcfa(item.total)}</p>
            </li>
          ))}
        </ul>
        <Totals
          rows={[
            ['Sous-total', formatFcfa(t.subtotal)],
            ...(t.discount ? [['Remise', `- ${formatFcfa(t.discount)}`] as [string, string]] : []),
            ...(t.travelFee ? [['Déplacement', formatFcfa(t.travelFee)] as [string, string]] : []),
            ['Total', formatFcfa(t.total), true],
          ]}
        />
      </div>
    );
  }
  const e = quote.estimate;
  return (
    <div className="flex flex-col gap-4">
      <ul className="divide-y divide-line rounded-lg border border-line">
        {e.lines.map((line) => (
          <li key={line.serviceId} className="flex flex-wrap justify-between gap-3 p-4">
            <div>
              <p className="text-label text-ink">{line.name}</p>
              <p className="text-body-sm text-ink-muted">
                {line.pricingMode === 'par_unite'
                  ? `${line.quantity} ${plural(line.unitLabel, line.quantity)}`
                  : 'Forfait'}
                {line.options.map((o) => ` · ${o.label} : ${o.value}`).join('')}
              </p>
            </div>
            <p className="text-label text-ink tabular-nums">
              {line.onQuote ? 'Sur devis' : rangeLabel(line.total)}
            </p>
          </li>
        ))}
      </ul>
      <Totals
        rows={[
          ...(e.volumeDiscount.max
            ? [['Remise volume', `- ${rangeLabel(e.volumeDiscount)}`] as [string, string]]
            : []),
          ...(e.urgency.percent
            ? [[`Urgence (${e.urgency.label})`, rangeLabel(e.urgency.amount)] as [string, string]]
            : []),
          ...(e.travel.status === 'included'
            ? [[`Déplacement (${e.travel.commune})`, formatFcfa(e.travel.fee)] as [string, string]]
            : []),
          ['Estimation', rangeLabel(e.total), true],
        ]}
      />
      <p className="text-caption text-ink-muted">
        Estimation calculée lors de la demande ; le devis définitif suit après étude.
      </p>
    </div>
  );
}

export function QuoteInfo({ quote }: { quote: QuoteDto }) {
  const rows: [string, string][] = [
    ['Demande du', formatDate(quote.submittedAt)],
    [
      'Contact',
      `${quote.contact.name}${quote.contact.company ? ` · ${quote.contact.company}` : ''}`,
    ],
    ['Téléphone', formatCiPhone(quote.contact.phone)],
    ['Email', quote.contact.email],
    [
      'Intervention',
      `${INTERVENTION_MODE_LABELS[quote.mode]}${quote.commune ? ` · ${quote.commune}` : ''}`,
    ],
    ['Délai', quote.estimate.urgency.label],
  ];
  if (quote.address) rows.push(['Adresse', quote.address]);
  if (quote.validUntil) rows.push(['Valable jusqu’au', formatDate(quote.validUntil)]);
  return (
    <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-caption text-ink-muted">{label}</dt>
          <dd className="text-ink break-words">{value}</dd>
        </div>
      ))}
      {quote.clientNotes && (
        <div className="sm:col-span-2">
          <dt className="text-caption text-ink-muted">Précisions</dt>
          <dd className="whitespace-pre-line text-ink">{quote.clientNotes}</dd>
        </div>
      )}
    </dl>
  );
}

/** Accepter ou refuser un devis envoyé ; le refus propose d'indiquer un motif. */
export function QuoteDecision({
  quote,
  onDecide,
  pending,
  error,
}: {
  quote: QuoteDto;
  onDecide: (decision: 'accept' | 'decline', reason: string) => void;
  pending: boolean;
  error: string | null;
}) {
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (quote.status === 'accepte') {
    return (
      <Alert
        variant="success"
        title="Devis accepté"
        action={
          <Button asChild>
            <Link to={`/rendez-vous?devis=${quote.reference}`}>Planifier l’intervention</Link>
          </Button>
        }
      >
        Merci pour votre confiance. Choisissez dès maintenant un créneau pour l’intervention.
      </Alert>
    );
  }
  if (quote.status === 'refuse') {
    return <Alert title="Devis refusé">Nous restons à votre disposition pour en reparler.</Alert>;
  }
  if (quote.status === 'expire') {
    return (
      <Alert variant="warning" title="Devis expiré">
        Sa date de validité est dépassée. Contactez-nous pour en obtenir un nouveau.
      </Alert>
    );
  }
  if (quote.status !== 'envoye') return null;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h4">Votre réponse</h2>
        <p className="text-body-sm text-ink-muted">
          {quote.validUntil
            ? `Ce devis est valable jusqu’au ${formatDate(quote.validUntil)}.`
            : 'Indiquez-nous votre décision.'}
        </p>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" loading={pending} onClick={() => onDecide('accept', '')}>
          Accepter le devis
        </Button>
        <Button size="lg" variant="outline" disabled={pending} onClick={() => setDeclineOpen(true)}>
          Refuser
        </Button>
      </div>
      <Modal
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        title="Refuser le devis"
        description="Un mot sur la raison nous aide à mieux vous répondre (facultatif)."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setDeclineOpen(false);
            onDecide('decline', reason.trim());
          }}
        >
          <TextArea
            label="Motif"
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeclineOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="secondary">
              Confirmer le refus
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
