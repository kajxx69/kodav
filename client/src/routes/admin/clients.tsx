import {
  PROFILE_META,
  formatFcfa,
  type ClientProfile,
  type ClientSummaryDto,
  type Paginated,
} from '@kodav/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Badge,
  Button,
  DataTable,
  ErrorState,
  SelectField,
  TextField,
  type Column,
} from '~/components/ui';
import { apiRequest, downloadProtectedFile } from '~/lib/api';
import { formatDate } from '~/lib/format';

const columns: Column<ClientSummaryDto>[] = [
  {
    key: 'name',
    header: 'Client',
    cell: (c) => (
      <Link to={`/admin/clients/${c.kind}/${c.id}`} className="flex flex-col">
        <span className="text-label text-link underline">{c.name}</span>
        <span className="text-caption text-ink-muted">
          {PROFILE_META[c.profile as ClientProfile]?.label ?? c.profile} · {c.email}
        </span>
      </Link>
    ),
    sortValue: (c) => c.name,
  },
  { key: 'members', header: 'Contacts', cell: (c) => c.members, sortValue: (c) => c.members },
  {
    key: 'subscription',
    header: 'Formule',
    cell: (c) => (c.subscription ? <Badge variant="gold">{c.subscription}</Badge> : '—'),
  },
  {
    key: 'tickets',
    header: 'Tickets ouverts',
    cell: (c) => c.openTickets,
    sortValue: (c) => c.openTickets,
  },
  { key: 'quotes', header: 'Devis', cell: (c) => c.quoteCount, sortValue: (c) => c.quoteCount },
  {
    key: 'invoiced',
    header: 'Facturé',
    cell: (c) => formatFcfa(c.invoicedTotal),
    sortValue: (c) => c.invoicedTotal,
    className: 'text-right tabular-nums',
  },
  {
    key: 'due',
    header: 'Reste dû',
    cell: (c) =>
      c.dueTotal ? <span className="text-warning">{formatFcfa(c.dueTotal)}</span> : '—',
    sortValue: (c) => c.dueTotal,
    className: 'text-right tabular-nums',
  },
  {
    key: 'since',
    header: 'Client depuis',
    cell: (c) => formatDate(c.createdAt),
    sortValue: (c) => c.createdAt,
  },
];

export default function AdminClients() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const type = params.get('type') ?? '';
  const query = useQuery({
    queryKey: ['private', 'admin', 'clients', { q, type }],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: '100' });
      if (q) qs.set('q', q);
      if (type) qs.set('type', type);
      return apiRequest<Paginated<ClientSummaryDto>>(`/admin/clients?${qs}`);
    },
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <SpaceHeader
        title="Clients et organisations"
        lead="Entreprises, écoles et particuliers : ouvrez une fiche pour tout voir en un endroit."
        actions={
          <Button
            variant="outline"
            onClick={() => void downloadProtectedFile('/admin/export/clients.csv')}
          >
            <Download aria-hidden />
            Export CSV
          </Button>
        }
      />
      <form
        role="search"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get('q') ?? '').trim();
          setParams({ ...(value && { q: value }), ...(type && { type }) }, { replace: true });
        }}
      >
        <TextField
          key={q}
          name="q"
          type="search"
          label="Rechercher"
          placeholder="Nom ou email"
          defaultValue={q}
          containerClassName="flex-1"
        />
        <SelectField
          label="Type"
          placeholder="Tous"
          value={type}
          containerClassName="sm:w-52"
          options={[
            { value: 'organisation', label: 'Organisations' },
            { value: 'particulier', label: 'Particuliers' },
          ]}
          onChange={(e) =>
            setParams(
              { ...(q && { q }), ...(e.target.value && { type: e.target.value }) },
              { replace: true },
            )
          }
        />
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          Rechercher
        </Button>
      </form>
      {query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption="Liste des clients"
          columns={columns}
          rows={query.data?.items}
          rowKey={(c) => `${c.kind}-${c.id}`}
          loading={query.isPending}
          emptyTitle="Aucun client"
        />
      )}
    </>
  );
}
