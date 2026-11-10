import { zodResolver } from '@hookform/resolvers/zod';
import {
  adminQuoteUpdateSchema,
  formatFcfa,
  type AdminQuoteDto,
  type AdminQuoteUpdateInput,
  type InvoiceDto,
} from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileDown, Plus, ReceiptText, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import type { z } from 'zod';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Modal,
  Skeleton,
  TextArea,
  TextField,
  toast,
} from '~/components/ui';
import { QuoteInfo, QuoteLines, QuoteStatusBadge, QuoteTimeline } from '~/features/quote/QuoteView';
import { apiRequest, openProtectedFile } from '~/lib/api';
import { applyServerErrors } from '~/lib/forms';

type FormOutput = z.output<typeof adminQuoteUpdateSchema>;
const CLOSED = ['accepte', 'refuse', 'expire'];

/** Lignes de départ : reprises de l'estimation, au milieu de la fourchette (arrondi à 500). */
function initialValues(quote: AdminQuoteDto): AdminQuoteUpdateInput {
  if (quote.finalItems.length) {
    return {
      finalItems: quote.finalItems,
      discount: quote.finalTotals?.discount ?? 0,
      travelFee: quote.finalTotals?.travelFee ?? 0,
      adminNotes: quote.adminNotes,
    };
  }
  return {
    finalItems: quote.estimate.lines.map((line) => ({
      label: line.name,
      description: line.options.map((o) => `${o.label} : ${o.value}`).join(' · '),
      quantity: line.quantity,
      unitLabel: line.pricingMode === 'par_unite' ? line.unitLabel : '',
      unitPrice: line.onQuote
        ? 0
        : Math.round((line.total.min + line.total.max) / 2 / line.quantity / 500) * 500,
    })),
    discount: 0,
    travelFee: quote.estimate.travel.fee,
    adminNotes: quote.adminNotes,
  };
}

function Editor({ quote }: { quote: AdminQuoteDto }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<AdminQuoteUpdateInput, unknown, FormOutput>({
    resolver: zodResolver(adminQuoteUpdateSchema),
    defaultValues: initialValues(quote),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'finalItems' });
  const watched = useWatch({ control });
  const subtotal = (watched.finalItems ?? []).reduce(
    (sum, i) => sum + (Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0),
    0,
  );
  const total = subtotal - (Number(watched.discount) || 0) + (Number(watched.travelFee) || 0);

  const onSaved = (updated: AdminQuoteDto) => {
    queryClient.setQueryData(['private', 'admin', 'quotes', quote.id], updated);
    void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'quotes'], exact: false });
    reset(initialValues(updated));
  };
  const save = useMutation({
    mutationFn: (values: FormOutput) =>
      apiRequest<AdminQuoteDto>(`/admin/quotes/${quote.id}`, { method: 'PATCH', json: values }),
    onSuccess(updated) {
      onSaved(updated);
      toast('Devis enregistré', { variant: 'success' });
    },
    onError(error) {
      setFormError(applyServerErrors(error, setError, []));
    },
  });
  const send = useMutation({
    mutationFn: async (input: { values: FormOutput; validityDays: number; message: string }) => {
      if (isDirty)
        await apiRequest(`/admin/quotes/${quote.id}`, { method: 'PATCH', json: input.values });
      return apiRequest<AdminQuoteDto>(`/admin/quotes/${quote.id}/send`, {
        method: 'POST',
        json: { validityDays: input.validityDays, message: input.message },
      });
    },
    onSuccess(updated) {
      onSaved(updated);
      setSendOpen(false);
      toast('Devis envoyé', {
        description: `Email envoyé à ${updated.contact.email}.`,
        variant: 'success',
      });
    },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        save.mutate(values);
      })}
      className="flex flex-col gap-5"
    >
      {formError && <Alert variant="danger">{formError}</Alert>}
      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[6rem_8rem_minmax(0,1fr)_auto] sm:items-start"
          >
            <TextField
              label="Libellé"
              containerClassName="sm:col-span-4"
              error={errors.finalItems?.[index]?.label?.message}
              {...register(`finalItems.${index}.label`)}
            />
            <TextField
              label="Détail"
              containerClassName="sm:col-span-4"
              {...register(`finalItems.${index}.description`)}
            />
            <TextField
              label="Qté"
              type="number"
              inputMode="numeric"
              min={1}
              error={errors.finalItems?.[index]?.quantity?.message}
              {...register(`finalItems.${index}.quantity`)}
            />
            <TextField
              label="Unité"
              placeholder="poste"
              {...register(`finalItems.${index}.unitLabel`)}
            />
            <TextField
              label="Prix unitaire (FCFA)"
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              error={errors.finalItems?.[index]?.unitPrice?.message}
              {...register(`finalItems.${index}.unitPrice`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="sm:mt-7"
              aria-label={`Supprimer la ligne ${index + 1}`}
              onClick={() => remove(index)}
            >
              <Trash2 className="size-5" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={() =>
            append({ label: '', description: '', quantity: 1, unitLabel: '', unitPrice: 0 })
          }
        >
          <Plus aria-hidden />
          Ajouter une ligne
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Remise (FCFA)"
          type="number"
          inputMode="numeric"
          min={0}
          step={500}
          error={errors.discount?.message}
          {...register('discount')}
        />
        <TextField
          label="Frais de déplacement (FCFA)"
          type="number"
          inputMode="numeric"
          min={0}
          step={500}
          error={errors.travelFee?.message}
          {...register('travelFee')}
        />
      </div>
      <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 text-body-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Sous-total</dt>
          <dd className="tabular-nums">{formatFcfa(subtotal)}</dd>
        </div>
        <div className="flex justify-between text-label">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatFcfa(Math.max(total, 0))}</dd>
        </div>
      </dl>
      <TextArea
        label="Notes internes"
        help="Jamais visibles par le client."
        {...register('adminNotes')}
      />
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="submit" variant="outline" loading={save.isPending} disabled={!isDirty}>
          Enregistrer
        </Button>
        <Button
          type="button"
          disabled={!fields.length || total <= 0}
          onClick={handleSubmit(() => setSendOpen(true))}
        >
          <Send aria-hidden />
          {quote.status === 'envoye' ? 'Renvoyer le devis' : 'Envoyer le devis'}
        </Button>
      </div>

      <Modal
        open={sendOpen}
        onOpenChange={setSendOpen}
        title="Envoyer le devis"
        description={`Le client reçoit le PDF et un lien pour l’accepter en ligne, à ${quote.contact.email}.`}
      >
        <SendForm
          pending={send.isPending}
          error={send.error?.message ?? null}
          onCancel={() => setSendOpen(false)}
          onSend={(validityDays, message) =>
            void handleSubmit((values) => send.mutate({ values, validityDays, message }))()
          }
        />
      </Modal>
    </form>
  );
}

function SendForm({
  pending,
  error,
  onCancel,
  onSend,
}: {
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSend: (validityDays: number, message: string) => void;
}) {
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState('');
  return (
    <div className="flex flex-col gap-4">
      {error && <Alert variant="danger">{error}</Alert>}
      <TextField
        label="Validité (jours)"
        type="number"
        min={1}
        max={365}
        value={days}
        onChange={(e) => setDays(Math.min(365, Math.max(1, Number(e.target.value) || 30)))}
      />
      <TextArea
        label="Message au client (facultatif)"
        maxLength={2000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={pending}
          onClick={() => onSend(days, message)}
        >
          Envoyer
        </Button>
      </div>
    </div>
  );
}

/** Facture d'un devis accepté (une seule par devis). */
function InvoiceButton({ quoteId }: { quoteId: string }) {
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: () =>
      apiRequest<InvoiceDto>(`/admin/invoices/from-quote/${quoteId}`, {
        method: 'POST',
        json: { dueDays: 15 },
      }),
    onSuccess: (invoice) => {
      toast('Facture émise', {
        description: `${invoice.reference} envoyée au client.`,
        variant: 'success',
      });
      navigate(`/admin/factures/${invoice.id}`);
    },
    onError: (err) =>
      toast('Facturation impossible', {
        description: err.message,
        variant: 'error',
      }),
  });
  return (
    <Button variant="secondary" loading={create.isPending} onClick={() => create.mutate()}>
      <ReceiptText aria-hidden />
      Facturer
    </Button>
  );
}

export default function AdminQuote() {
  const { id = '' } = useParams();
  const query = useQuery({
    queryKey: ['private', 'admin', 'quotes', id],
    queryFn: () => apiRequest<AdminQuoteDto>(`/admin/quotes/${encodeURIComponent(id)}`),
  });
  const back = (
    <Link to="/admin/devis" className="inline-flex items-center gap-1 text-label text-link">
      <ArrowLeft className="size-4" aria-hidden />
      Devis
    </Link>
  );
  if (query.isPending) {
    return (
      <>
        {back}
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80" />
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        {back}
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      </>
    );
  }
  const quote = query.data;
  const closed = CLOSED.includes(quote.status);
  return (
    <>
      {back}
      <SpaceHeader
        title={`Devis ${quote.reference}`}
        lead={<QuoteStatusBadge status={quote.status} />}
        actions={
          <>
            {quote.status === 'accepte' && <InvoiceButton quoteId={quote.id} />}
            <Button
              variant="outline"
              onClick={() =>
                openProtectedFile(`/admin/quotes/${quote.id}/pdf`).catch((err: Error) =>
                  toast('PDF indisponible', { description: err.message, variant: 'error' }),
                )
              }
            >
              <FileDown aria-hidden />
              Aperçu PDF
            </Button>
          </>
        }
      />
      {quote.estimate.isPlaceholderPrice && !closed && (
        <Alert variant="warning">
          L’estimation du client a été calculée avec des tarifs d’exemple : vérifiez les prix avant
          l’envoi.
        </Alert>
      )}
      {quote.decisionReason && (
        <Alert title="Motif indiqué par le client">{quote.decisionReason}</Alert>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <h2 className="text-h4">{closed ? 'Devis' : 'Lignes du devis'}</h2>
            {closed ? <QuoteLines quote={quote} /> : <Editor quote={quote} />}
          </Card>
          <Card className="flex flex-col gap-4">
            <h2 className="text-h4">Demande du client</h2>
            <QuoteInfo quote={quote} />
            {!closed && (
              <details className="rounded-md border border-line p-4">
                <summary className="cursor-pointer text-label text-ink">
                  Estimation en ligne
                </summary>
                <div className="mt-4">
                  <QuoteLines quote={{ ...quote, finalTotals: null }} />
                </div>
              </details>
            )}
          </Card>
        </div>
        <Card className="h-fit">
          <h2 className="mb-4 text-h4">Suivi</h2>
          <QuoteTimeline quote={quote} />
        </Card>
      </div>
    </>
  );
}
