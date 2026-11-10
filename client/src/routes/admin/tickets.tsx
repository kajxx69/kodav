import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  type Paginated,
  type TicketDto,
  type TicketPriority,
} from '@kodav/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Badge,
  Button,
  DataTable,
  ErrorState,
  SelectField,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextField,
  type Column,
} from '~/components/ui';
import { PriorityBadge, SlaIndicator, TicketStatusBadge } from '~/features/support/TicketBadges';
import { apiRequest } from '~/lib/api';
import { formatDateTime } from '~/lib/format';
import { useTicketsLive } from '~/lib/realtime';

const PRIORITY_ORDER: Record<TicketPriority, number> = {
  critique: 0,
  haute: 1,
  normale: 2,
  basse: 3,
};
type Member = { id: string; name: string };

/** Colonne du kanban : les plus urgents d'abord (priorité, puis échéance). */
function Column({
  status,
  items,
}: {
  status: (typeof TICKET_STATUSES)[number];
  items: TicketDto[];
}) {
  const sorted = [...items].sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      a.slaDueAt.localeCompare(b.slaDueAt),
  );
  return (
    <section
      aria-labelledby={`col-${status}`}
      className="flex w-72 shrink-0 flex-col gap-3 rounded-lg bg-surface-sunken p-3 lg:w-auto lg:min-w-0 lg:flex-1"
    >
      <h2
        id={`col-${status}`}
        className="flex items-center justify-between px-1 text-label text-ink"
      >
        {status === 'attente_client' ? 'Attente client' : TICKET_STATUS_LABELS[status]}
        <Badge>{items.length}</Badge>
      </h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((t) => (
          <li key={t.id}>
            <Link
              to={`/admin/tickets/${t.id}`}
              className="flex flex-col gap-2 rounded-md border border-line bg-surface-raised p-3 shadow-sm hover:border-field-border"
            >
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-caption text-ink-muted">{t.reference}</span>
                <PriorityBadge priority={t.priority} />
                {t.unread > 0 && <Badge variant="gold">{t.unread}</Badge>}
              </span>
              <span className="line-clamp-2 text-body-sm text-ink">{t.subject}</span>
              <span className="text-caption text-ink-muted">
                {t.client?.organization ?? t.client?.name}
                {t.assignee ? ` · ${t.assignee.name}` : ' · non assigné'}
              </span>
              {!['resolu', 'ferme'].includes(status) && <SlaIndicator ticket={t} />}
            </Link>
          </li>
        ))}
        {!items.length && <li className="px-1 text-caption text-ink-muted">Aucun ticket</li>}
      </ul>
    </section>
  );
}

const columns: Column<TicketDto>[] = [
  {
    key: 'reference',
    header: 'Référence',
    cell: (t) => (
      <Link to={`/admin/tickets/${t.id}`} className="text-label text-link underline">
        {t.reference}
      </Link>
    ),
    sortValue: (t) => t.reference,
  },
  {
    key: 'subject',
    header: 'Sujet',
    cell: (t) => <span className="line-clamp-2">{t.subject}</span>,
  },
  { key: 'client', header: 'Client', cell: (t) => t.client?.organization ?? t.client?.name ?? '—' },
  {
    key: 'priority',
    header: 'Priorité',
    cell: (t) => <PriorityBadge priority={t.priority} />,
    sortValue: (t) => PRIORITY_ORDER[t.priority],
  },
  { key: 'status', header: 'Statut', cell: (t) => <TicketStatusBadge status={t.status} staff /> },
  { key: 'assignee', header: 'Assigné', cell: (t) => t.assignee?.name ?? '—' },
  {
    key: 'sla',
    header: 'Délai',
    cell: (t) => <SlaIndicator ticket={t} />,
    sortValue: (t) => t.slaDueAt,
  },
  {
    key: 'last',
    header: 'Dernier échange',
    cell: (t) => formatDateTime(t.lastMessageAt),
    sortValue: (t) => t.lastMessageAt,
  },
];

export default function AdminTickets() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const priority = params.get('priorite') ?? '';
  const assignee = params.get('assigne') ?? '';
  const q = params.get('q') ?? '';
  const update = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) merged.set(k, v);
      else merged.delete(k);
    }
    setParams(merged, { replace: true });
  };

  const query = useQuery({
    queryKey: ['private', 'staff-tickets', 'board', { priority, assignee, q }],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: '200' });
      if (priority) qs.set('priority', priority);
      if (assignee) qs.set('assignee', assignee);
      if (q) qs.set('q', q);
      return apiRequest<Paginated<TicketDto>>(`/tickets?${qs}`);
    },
  });
  const team = useQuery({
    queryKey: ['private', 'admin', 'team'],
    queryFn: () => apiRequest<Member[]>('/admin/tickets/team'),
  });
  useTicketsLive(
    () => void queryClient.invalidateQueries({ queryKey: ['private', 'staff-tickets'] }),
  );

  const byStatus = (s: string) => query.data?.items.filter((t) => t.status === s) ?? [];
  return (
    <>
      <SpaceHeader
        title="Tickets"
        lead="Demandes de support : priorités, délais cibles et affectation."
      />
      <form
        role="search"
        className="flex flex-col gap-3 md:flex-row md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: String(new FormData(e.currentTarget).get('q') ?? '').trim() || undefined });
        }}
      >
        <TextField
          key={q}
          name="q"
          type="search"
          label="Rechercher"
          placeholder="Référence ou sujet"
          defaultValue={q}
          containerClassName="flex-1"
        />
        <SelectField
          label="Priorité"
          placeholder="Toutes"
          value={priority}
          containerClassName="md:w-44"
          options={TICKET_PRIORITIES.map((p) => ({ value: p, label: TICKET_PRIORITY_LABELS[p] }))}
          onChange={(e) => update({ priorite: e.target.value || undefined })}
        />
        <SelectField
          label="Assigné à"
          placeholder="Tout le monde"
          value={assignee}
          containerClassName="md:w-52"
          options={[
            { value: 'none', label: 'Non assignés' },
            ...(team.data ?? []).map((m) => ({ value: m.id, label: m.name })),
          ]}
          onChange={(e) => update({ assigne: e.target.value || undefined })}
        />
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          Rechercher
        </Button>
      </form>
      {query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <Skeleton className="h-96" />
      ) : (
        <Tabs defaultValue="kanban">
          <TabsList aria-label="Affichage">
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="liste">Liste</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban">
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
              {TICKET_STATUSES.map((s) => (
                <Column key={s} status={s} items={byStatus(s)} />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="liste">
            <DataTable
              caption="Liste des tickets"
              columns={columns}
              rows={query.data.items}
              rowKey={(t) => t.id}
              emptyTitle="Aucun ticket"
            />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
