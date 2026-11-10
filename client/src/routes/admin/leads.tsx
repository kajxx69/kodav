import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  PROFILE_META,
  formatCiPhone,
  type ClientProfile,
  type LeadDto,
  type LeadStatus,
  type Paginated,
} from '@kodav/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Inbox, Mail, Phone } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SelectField,
  Skeleton,
  TextArea,
  toast,
} from '~/components/ui';
import { apiRequest, downloadProtectedFile } from '~/lib/api';
import { formatDateTime, telLink } from '~/lib/format';

const STATUS_VARIANT: Record<LeadStatus, 'info' | 'gold' | 'success' | 'neutral'> = {
  nouveau: 'info',
  contacte: 'gold',
  converti: 'success',
  perdu: 'neutral',
};

function LeadCard({ lead }: { lead: LeadDto }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(lead.notes);
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest(`/admin/leads/${lead.id}`, { method: 'PATCH', json: body }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'leads'] }),
    onError: (err) =>
      toast('Modification impossible', { description: err.message, variant: 'error' }),
  });
  const call = telLink(lead.phone);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-label text-ink">{lead.name}</span>
            {lead.company && <span className="text-body-sm text-ink-muted">· {lead.company}</span>}
            <Badge variant={STATUS_VARIANT[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
            <Badge>{LEAD_SOURCE_LABELS[lead.source]}</Badge>
          </p>
          <p className="text-caption text-ink-muted">
            {formatDateTime(lead.createdAt)}
            {lead.profile &&
              ` · ${PROFILE_META[lead.profile as ClientProfile]?.label ?? lead.profile}`}
            {lead.commune && ` · ${lead.commune}`}
            {lead.quoteReference && ' · devis '}
            {lead.quoteReference && (
              <Link to={`/admin/devis?q=${lead.quoteReference}`} className="text-link underline">
                {lead.quoteReference}
              </Link>
            )}
          </p>
        </div>
        <SelectField
          label="Statut"
          containerClassName="w-44"
          value={lead.status}
          options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))}
          onChange={(e) => update.mutate({ status: e.target.value })}
        />
      </div>
      {lead.subject && <p className="text-label text-ink">{lead.subject}</p>}
      {lead.message && <p className="whitespace-pre-line text-body-sm text-ink">{lead.message}</p>}
      <div className="flex flex-wrap gap-2">
        {call && (
          <Button asChild variant="outline" size="sm">
            <a href={call}>
              <Phone aria-hidden />
              {formatCiPhone(lead.phone)}
            </a>
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <a href={`mailto:${lead.email}`}>
            <Mail aria-hidden />
            {lead.email}
          </a>
        </Button>
      </div>
      <TextArea
        label="Notes de suivi"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== lead.notes && update.mutate({ notes })}
        help="Enregistrées en quittant le champ."
      />
    </Card>
  );
}

export default function AdminLeads() {
  const [params, setParams] = useSearchParams();
  const status = params.get('statut') ?? 'nouveau';
  const source = params.get('source') ?? '';
  const query = useQuery({
    queryKey: ['private', 'admin', 'leads', { status, source }],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: '50' });
      if (status !== 'tous') qs.set('status', status);
      if (source) qs.set('source', source);
      return apiRequest<Paginated<LeadDto>>(`/admin/leads?${qs}`);
    },
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <SpaceHeader
        title="Prospects"
        lead="Demandes issues du formulaire de contact, du diagnostic et des devis sans compte."
        actions={
          <Button
            variant="outline"
            onClick={() => void downloadProtectedFile('/admin/export/prospects.csv')}
          >
            <Download aria-hidden />
            Export CSV
          </Button>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <SelectField
          label="Statut"
          value={status}
          containerClassName="sm:w-52"
          options={[
            { value: 'tous', label: 'Tous' },
            ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })),
          ]}
          onChange={(e) =>
            setParams({ statut: e.target.value, ...(source && { source }) }, { replace: true })
          }
        />
        <SelectField
          label="Origine"
          placeholder="Toutes"
          value={source}
          containerClassName="sm:w-64"
          options={LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] }))}
          onChange={(e) =>
            setParams(
              { statut: status, ...(e.target.value && { source: e.target.value }) },
              { replace: true },
            )
          }
        />
      </div>
      {query.isPending ? (
        <Skeleton className="h-48" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : !query.data.items.length ? (
        <EmptyState
          icon={Inbox}
          title="Aucun prospect"
          description="Les demandes du site apparaîtront ici."
        />
      ) : (
        <div className="grid gap-4">
          {query.data.items.map((l) => (
            <LeadCard key={`${l.id}-${l.status}`} lead={l} />
          ))}
        </div>
      )}
    </>
  );
}
