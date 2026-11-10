import { zodResolver } from '@hookform/resolvers/zod';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  formatFcfa,
  paymentInputSchema,
  type InvoiceDto,
  type PaymentInput,
} from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, FileDown } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import type { z } from 'zod';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  SelectField,
  Skeleton,
  TextField,
  toast,
} from '~/components/ui';
import { InvoiceStatusBadge } from '~/features/billing/InvoiceBadges';
import { apiRequest, openProtectedFile } from '~/lib/api';
import { formatDate, plural } from '~/lib/format';
import { applyServerErrors } from '~/lib/forms';

type PaymentOutput = z.output<typeof paymentInputSchema>;

function PaymentForm({
  invoice,
  onSaved,
}: {
  invoice: InvoiceDto;
  onSaved: (i: InvoiceDto) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const remaining = invoice.total - invoice.paid;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PaymentInput, unknown, PaymentOutput>({
    resolver: zodResolver(paymentInputSchema),
    defaultValues: {
      amount: remaining,
      method: 'mobile_money',
      reference: '',
      paidAt: new Date().toISOString().slice(0, 10),
    },
  });
  const save = useMutation({
    mutationFn: (v: PaymentOutput) =>
      apiRequest<InvoiceDto>(`/admin/invoices/${invoice.id}/payments`, { method: 'POST', json: v }),
    onSuccess(i) {
      onSaved(i);
      toast('Règlement enregistré', { variant: 'success' });
    },
    onError: (err) =>
      setFormError(applyServerErrors(err, setError, ['amount', 'method', 'paidAt', 'reference'])),
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        save.mutate(v);
      })}
      className="grid gap-4 sm:grid-cols-2"
    >
      {formError && (
        <Alert variant="danger" className="sm:col-span-2">
          {formError}
        </Alert>
      )}
      <TextField
        label="Montant (FCFA)"
        type="number"
        inputMode="numeric"
        min={1}
        max={remaining}
        help={`Reste à payer : ${formatFcfa(remaining)}`}
        error={errors.amount?.message}
        {...register('amount')}
      />
      <SelectField
        label="Moyen"
        options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
        error={errors.method?.message}
        {...register('method')}
      />
      <TextField label="Date" type="date" error={errors.paidAt?.message} {...register('paidAt')} />
      <TextField
        label="Référence"
        placeholder="N° de transaction, de chèque…"
        {...register('reference')}
      />
      <Button
        type="submit"
        variant="secondary"
        className="sm:col-span-2 sm:justify-self-start"
        loading={save.isPending}
      >
        Enregistrer le règlement
      </Button>
    </form>
  );
}

export default function AdminInvoice() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const key = ['private', 'admin', 'invoices', id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<InvoiceDto>(`/admin/invoices/${encodeURIComponent(id)}`),
  });
  const onSaved = (i: InvoiceDto) => {
    queryClient.setQueryData(key, i);
    void queryClient.invalidateQueries({
      queryKey: ['private', 'admin', 'invoices'],
      exact: false,
      refetchType: 'none',
    });
  };
  const cancel = useMutation({
    mutationFn: () => apiRequest<InvoiceDto>(`/admin/invoices/${id}/cancel`, { method: 'POST' }),
    onSuccess: onSaved,
    onError: (err) =>
      toast('Annulation impossible', { description: err.message, variant: 'error' }),
  });
  const back = (
    <Link to="/admin/factures" className="inline-flex items-center gap-1 text-label text-link">
      <ArrowLeft className="size-4" aria-hidden />
      Factures
    </Link>
  );
  if (query.isPending)
    return (
      <>
        {back}
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80" />
      </>
    );
  if (query.isError)
    return (
      <>
        {back}
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      </>
    );
  const i = query.data;
  const open = ['impayee', 'partielle'].includes(i.status);
  return (
    <>
      {back}
      <SpaceHeader
        title={`Facture ${i.reference}`}
        lead={
          <span className="flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge status={i.status} overdue={i.overdue} />
            <span className="text-body-sm">
              Devis{' '}
              <Link className="text-link underline" to={`/admin/devis/${i.quote.id}`}>
                {i.quote.reference}
              </Link>
            </span>
          </span>
        }
        actions={
          <>
            {i.status === 'impayee' && i.paid === 0 && (
              <Button
                variant="ghost"
                loading={cancel.isPending}
                onClick={() => {
                  if (window.confirm(`Annuler la facture ${i.reference} ?`)) cancel.mutate();
                }}
              >
                <Ban aria-hidden />
                Annuler
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() =>
                openProtectedFile(`/admin/invoices/${i.id}/pdf`).catch((err: Error) =>
                  toast('PDF indisponible', { description: err.message, variant: 'error' }),
                )
              }
            >
              <FileDown aria-hidden />
              PDF
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="flex flex-col gap-4">
          <h2 className="text-h4">Lignes</h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {i.items.map((it, n) => (
              <li key={n} className="flex flex-wrap justify-between gap-3 p-4">
                <span>
                  <span className="block text-label text-ink">{it.label}</span>
                  <span className="text-body-sm text-ink-muted">
                    {it.quantity} {plural(it.unitLabel, it.quantity)} × {formatFcfa(it.unitPrice)}
                  </span>
                </span>
                <span className="text-label tabular-nums">{formatFcfa(it.total)}</span>
              </li>
            ))}
          </ul>
          <dl className="ml-auto grid w-full max-w-sm gap-1 text-body-sm">
            {(
              [
                ['Sous-total', formatFcfa(i.subtotal)],
                ...(i.discount ? [['Remise', `- ${formatFcfa(i.discount)}`]] : []),
                ...(i.travelFee ? [['Déplacement', formatFcfa(i.travelFee)]] : []),
                [
                  i.taxRate ? `TVA ${i.taxRate} %` : 'TVA',
                  i.taxRate ? formatFcfa(i.taxAmount) : 'Non applicable',
                ],
                ['Total', formatFcfa(i.total)],
                ['Réglé', formatFcfa(i.paid)],
                ['Reste à payer', formatFcfa(Math.max(i.total - i.paid, 0))],
              ] as [string, string][]
            ).map(([l, v]) => (
              <div key={l} className="flex justify-between gap-3">
                <dt className="text-ink-muted">{l}</dt>
                <dd className="tabular-nums text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-2 text-body-sm">
            <h2 className="text-h4">Facturé à</h2>
            <p className="text-ink">{i.billing.company}</p>
            <p className="text-ink">{i.billing.name}</p>
            <p className="text-ink-muted">{i.billing.address}</p>
            <p className="text-ink-muted">{i.billing.email}</p>
            <p className="text-ink-muted">
              Émise le {formatDate(i.issuedAt)} · échéance {formatDate(i.dueAt)}
            </p>
          </Card>
          <Card className="flex flex-col gap-4">
            <h2 className="text-h4">Règlements</h2>
            {i.payments.length ? (
              <ul className="flex flex-col gap-2 text-body-sm">
                {i.payments.map((p, n) => (
                  <li key={n} className="flex justify-between gap-2">
                    <span>
                      {formatDate(p.paidAt)} · {PAYMENT_METHOD_LABELS[p.method]}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </span>
                    <span className="tabular-nums">{formatFcfa(p.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-ink-muted">Aucun règlement enregistré.</p>
            )}
            {open && <PaymentForm key={i.paid} invoice={i} onSaved={onSaved} />}
          </Card>
        </div>
      </div>
    </>
  );
}
