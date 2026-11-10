import { zodResolver } from '@hookform/resolvers/zod';
import {
  APPOINTMENT_STATUS_LABELS,
  ASSET_TYPE_LABELS,
  INVOICE_STATUS_LABELS,
  PROFILE_META,
  QUOTE_STATUS_LABELS,
  TICKET_STATUS_LABELS,
  formatCiPhone,
  formatFcfa,
  subscriptionInputSchema,
  type AppointmentStatus,
  type AssetType,
  type Client360Dto,
  type ClientProfile,
  type MaintenancePlan,
  type QuoteStatus,
  type SubscriptionInput,
  type TicketStatus,
} from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import type { z } from 'zod';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Modal,
  SelectField,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
  TextField,
  toast,
} from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { formatDate, formatDateTime } from '~/lib/format';
import { applyServerErrors } from '~/lib/forms';

type SubOutput = z.output<typeof subscriptionInputSchema>;

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="text-h4 text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function Rows<T>({
  items,
  empty,
  render,
}: {
  items: T[];
  empty: string;
  render: (item: T) => ReactNode;
}) {
  if (!items.length) return <p className="p-4 text-body-sm text-ink-muted">{empty}</p>;
  return <ul className="divide-y divide-line">{items.map(render)}</ul>;
}

function Row({
  to,
  title,
  meta,
  badge,
}: {
  to?: string;
  title: ReactNode;
  meta: ReactNode;
  badge?: ReactNode;
}) {
  const content = (
    <>
      <span className="flex flex-col">
        <span className="text-label text-ink">{title}</span>
        <span className="text-caption text-ink-muted">{meta}</span>
      </span>
      {badge}
    </>
  );
  return (
    <li>
      {to ? (
        <Link
          to={to}
          className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-sunken"
        >
          {content}
        </Link>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">{content}</div>
      )}
    </li>
  );
}

function SubscriptionForm({ client, onDone }: { client: Client360Dto; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const plans = useQuery({
    queryKey: ['private', 'admin', 'plans'],
    queryFn: () => apiRequest<MaintenancePlan[]>('/admin/plans'),
  });
  const current = client.subscription360;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SubscriptionInput, unknown, SubOutput>({
    resolver: zodResolver(subscriptionInputSchema),
    defaultValues: {
      planId: current?.plan.id ?? '',
      seats: current?.seats ?? 5,
      billingCycle: current?.billingCycle ?? 'mensuel',
      startDate: current?.startDate ?? new Date().toISOString().slice(0, 10),
      endDate: current?.endDate ?? '',
      status: 'active',
    },
  });
  const save = useMutation({
    mutationFn: (v: SubOutput) =>
      apiRequest(`/admin/clients/${client.kind}/${client.id}/subscription`, {
        method: 'PUT',
        json: v,
      }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'clients'] });
      toast('Formule enregistrée', { variant: 'success' });
      onDone();
    },
    onError: (err) =>
      setFormError(applyServerErrors(err, setError, ['planId', 'seats', 'startDate'])),
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
      <SelectField
        label="Formule"
        placeholder="Choisir…"
        containerClassName="sm:col-span-2"
        options={(plans.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
        error={errors.planId?.message}
        {...register('planId')}
      />
      <TextField
        label="Postes couverts"
        type="number"
        min={1}
        error={errors.seats?.message}
        {...register('seats')}
      />
      <SelectField
        label="Facturation"
        options={[
          { value: 'mensuel', label: 'Mensuelle' },
          { value: 'annuel', label: 'Annuelle' },
        ]}
        {...register('billingCycle')}
      />
      <TextField
        label="Début"
        type="date"
        error={errors.startDate?.message}
        {...register('startDate')}
      />
      <TextField label="Fin (facultatif)" type="date" {...register('endDate')} />
      <SelectField
        label="Statut"
        options={[
          { value: 'active', label: 'Active' },
          { value: 'suspendue', label: 'Suspendue' },
          { value: 'resiliee', label: 'Résiliée' },
        ]}
        {...register('status')}
      />
      <p className="text-caption text-ink-muted sm:col-span-2">
        Les délais cibles des tickets du client suivent la formule active.
      </p>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" variant="secondary" loading={save.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function RevealKey({ assetId }: { assetId: string }) {
  const [key, setKey] = useState<string | null>(null);
  const reveal = useMutation({
    mutationFn: () =>
      apiRequest<{ key: string }>(`/admin/assets/${assetId}/reveal-key`, { method: 'POST' }),
    onSuccess: (r) => setKey(r.key),
    onError: (err) => toast('Clé indisponible', { description: err.message, variant: 'error' }),
  });
  return key ? (
    <code className="rounded-sm bg-surface-sunken px-2 py-1 text-body-sm select-all">{key}</code>
  ) : (
    <Button
      variant="ghost"
      size="sm"
      loading={reveal.isPending}
      onClick={() => {
        if (
          window.confirm(
            'Afficher la clé de licence confiée ? Cet accès est enregistré dans le journal.',
          )
        )
          reveal.mutate();
      }}
    >
      <KeyRound aria-hidden />
      Afficher la clé
    </Button>
  );
}

export default function AdminClient() {
  const { kind = '', id = '' } = useParams();
  const queryClient = useQueryClient();
  const key = ['private', 'admin', 'clients', kind, id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<Client360Dto>(`/admin/clients/${kind}/${encodeURIComponent(id)}`),
  });
  const [notes, setNotes] = useState<string | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const saveNotes = useMutation({
    mutationFn: (value: string) =>
      apiRequest(`/admin/clients/${kind}/${id}/notes`, { method: 'PATCH', json: { notes: value } }),
    onSuccess: () => {
      toast('Notes enregistrées', { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const back = (
    <Link to="/admin/clients" className="inline-flex items-center gap-1 text-label text-link">
      <ArrowLeft className="size-4" aria-hidden />
      Clients
    </Link>
  );
  if (query.isPending)
    return (
      <>
        {back}
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </>
    );
  if (query.isError)
    return (
      <>
        {back}
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      </>
    );
  const c = query.data;
  const sub = c.subscription360;
  return (
    <>
      {back}
      <SpaceHeader
        title={c.name}
        lead={`${PROFILE_META[c.profile as ClientProfile]?.label ?? c.profile} · client depuis le ${formatDate(c.createdAt)}`}
        actions={
          <Button variant="outline" onClick={() => setSubOpen(true)}>
            {sub ? 'Modifier la formule' : 'Souscrire une formule'}
          </Button>
        }
      />
      <Card>
        <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Formule"
            value={
              sub ? (
                <Badge variant="gold">
                  {sub.plan.name} · {sub.seats} postes
                </Badge>
              ) : (
                '—'
              )
            }
          />
          <Stat label="Tickets ouverts" value={c.openTickets} />
          <Stat label="Devis" value={c.quoteCount} />
          <Stat label="Interventions" value={c.appointments.length} />
          <Stat label="Facturé" value={formatFcfa(c.invoicedTotal)} />
          <Stat
            label="Reste dû"
            value={
              c.dueTotal ? (
                <span className="text-warning">{formatFcfa(c.dueTotal)}</span>
              ) : (
                formatFcfa(0)
              )
            }
          />
        </dl>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Tabs defaultValue="devis">
          <TabsList aria-label="Historique du client">
            <TabsTrigger value="devis">Devis</TabsTrigger>
            <TabsTrigger value="interventions">Interventions</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="parc">Parc</TabsTrigger>
            <TabsTrigger value="factures">Factures</TabsTrigger>
          </TabsList>
          <Card className="mt-4 p-0">
            <TabsContent value="devis" className="mt-0">
              <Rows
                items={c.quotes}
                empty="Aucun devis."
                render={(q) => (
                  <Row
                    key={q.id}
                    to={`/admin/devis/${q.id}`}
                    title={q.reference}
                    meta={formatDate(q.createdAt)}
                    badge={
                      <span className="flex items-center gap-2">
                        <Badge>{QUOTE_STATUS_LABELS[q.status as QuoteStatus]}</Badge>
                        {q.total !== null && (
                          <span className="text-body-sm tabular-nums">{formatFcfa(q.total)}</span>
                        )}
                      </span>
                    }
                  />
                )}
              />
            </TabsContent>
            <TabsContent value="interventions" className="mt-0">
              <Rows
                items={c.appointments}
                empty="Aucune intervention."
                render={(a) => (
                  <Row
                    key={a.id}
                    to="/admin/planning"
                    title={a.reference}
                    meta={`${formatDateTime(a.start)}${a.service ? ` · ${a.service}` : ''}`}
                    badge={
                      <Badge>{APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus]}</Badge>
                    }
                  />
                )}
              />
            </TabsContent>
            <TabsContent value="tickets" className="mt-0">
              <Rows
                items={c.tickets}
                empty="Aucun ticket."
                render={(t) => (
                  <Row
                    key={t.id}
                    to={`/admin/tickets/${t.id}`}
                    title={`${t.reference} · ${t.subject}`}
                    meta={`${formatDate(t.createdAt)} · priorité ${t.priority}`}
                    badge={<Badge>{TICKET_STATUS_LABELS[t.status as TicketStatus]}</Badge>}
                  />
                )}
              />
            </TabsContent>
            <TabsContent value="parc" className="mt-0">
              <Rows
                items={c.assets}
                empty="Parc non renseigné."
                render={(a) => (
                  <Row
                    key={a.id}
                    title={a.name}
                    meta={`${ASSET_TYPE_LABELS[a.type as AssetType]}${a.licenseExpiresAt ? ` · expire le ${formatDate(a.licenseExpiresAt)}` : ''}`}
                    badge={a.keyStored ? <RevealKey assetId={a.id} /> : undefined}
                  />
                )}
              />
            </TabsContent>
            <TabsContent value="factures" className="mt-0">
              <Rows
                items={c.invoices}
                empty="Aucune facture."
                render={(i) => (
                  <Row
                    key={i.id}
                    to={`/admin/factures/${i.id}`}
                    title={i.reference}
                    meta={`${formatDate(i.issuedAt)} · ${formatFcfa(i.total)} · réglé ${formatFcfa(i.paid)}`}
                    badge={<Badge>{INVOICE_STATUS_LABELS[i.status]}</Badge>}
                  />
                )}
              />
            </TabsContent>
          </Card>
        </Tabs>
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-3 text-body-sm">
            <h2 className="text-h4">Coordonnées</h2>
            <p className="text-ink">{c.email}</p>
            {c.phone && <p className="text-ink">{formatCiPhone(c.phone)}</p>}
            {(c.address.street || c.address.commune) && (
              <p className="text-ink-muted">
                {[c.address.street, c.address.commune, c.address.city].filter(Boolean).join(', ')}
              </p>
            )}
            {(c.taxId || c.rccm) && (
              <p className="text-ink-muted">
                {c.taxId && `CC ${c.taxId}`} {c.rccm && `· RCCM ${c.rccm}`}
              </p>
            )}
            <h3 className="mt-2 text-label text-ink">Contacts</h3>
            <ul className="flex flex-col gap-2">
              {c.contacts.map((p) => (
                <li key={p.id}>
                  <span className="block text-ink">
                    {p.name}
                    {p.orgRole === 'owner' && ' · responsable'}
                    {!p.isActive && ' · désactivé'}
                  </span>
                  <span className="text-ink-muted">{p.email}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-h4">Notes internes</h2>
            <TextArea
              label="Notes"
              help="Jamais visibles par le client."
              value={notes ?? c.notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              disabled={notes === null || notes === c.notes}
              loading={saveNotes.isPending}
              onClick={() => saveNotes.mutate(notes ?? '')}
            >
              Enregistrer
            </Button>
          </Card>
        </div>
      </div>
      <Modal
        open={subOpen}
        onOpenChange={setSubOpen}
        title="Formule de maintenance"
        description={
          sub
            ? `Actuelle : ${sub.plan.name}, ${sub.seats} postes, ${formatFcfa(sub.monthlyPrice)} par mois.`
            : undefined
        }
      >
        {subOpen && <SubscriptionForm client={c} onDone={() => setSubOpen(false)} />}
      </Modal>
    </>
  );
}
