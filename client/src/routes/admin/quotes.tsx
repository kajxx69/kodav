import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
  formatFcfa,
  type AdminQuoteDto,
  type Paginated,
} from '@kodav/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Button,
  DataTable,
  ErrorState,
  SelectField,
  TextField,
  type Column,
} from '~/components/ui';
import { QuoteStatusBadge } from '~/features/quote/QuoteView';
import { apiRequest } from '~/lib/api';
import { formatDate, rangeLabel } from '~/lib/format';

const PAGE_SIZE = 20;

const columns: Column<AdminQuoteDto>[] = [
  {
    key: 'reference',
    header: 'Référence',
    cell: (q) => (
      <Link to={`/admin/devis/${q.id}`} className="text-label text-link underline">
        {q.reference}
      </Link>
    ),
    sortValue: (q) => q.reference,
  },
  {
    key: 'client',
    header: 'Client',
    cell: (q) => (
      <span>
        <span className="block">{q.contact.company || q.contact.name}</span>
        <span className="block text-caption text-ink-muted">
          {q.contact.company ? `${q.contact.name} · ` : ''}
          {q.hasAccount ? 'compte client' : 'sans compte'}
        </span>
      </span>
    ),
    sortValue: (q) => q.contact.company || q.contact.name,
  },
  {
    key: 'services',
    header: 'Services',
    cell: (q) => (
      <span className="line-clamp-2">{q.estimate.lines.map((l) => l.name).join(', ')}</span>
    ),
  },
  {
    key: 'amount',
    header: 'Montant',
    cell: (q) =>
      q.finalTotals ? (
        formatFcfa(q.finalTotals.total)
      ) : (
        <span className="text-ink-muted">≈ {rangeLabel(q.estimate.total)}</span>
      ),
    sortValue: (q) => q.finalTotals?.total ?? q.estimate.total.max,
  },
  {
    key: 'status',
    header: 'Statut',
    cell: (q) => <QuoteStatusBadge status={q.status} />,
    sortValue: (q) => q.status,
  },
  {
    key: 'date',
    header: 'Demande',
    cell: (q) => formatDate(q.submittedAt),
    sortValue: (q) => q.submittedAt,
  },
];

const statusOptions = QUOTE_STATUSES.filter((s) => s !== 'brouillon').map((s) => ({
  value: s,
  label: QUOTE_STATUS_LABELS[s],
}));

export default function AdminQuotes() {
  const [params, setParams] = useSearchParams();
  const status = params.get('statut') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const update = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  };

  const query = useQuery({
    queryKey: ['private', 'admin', 'quotes', { status, q, page }],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (status) qs.set('status', status);
      if (q) qs.set('q', q);
      return apiRequest<Paginated<AdminQuoteDto>>(`/admin/quotes?${qs}`);
    },
    placeholderData: keepPreviousData,
  });
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <SpaceHeader title="Devis" lead="Demandes reçues, devis en cours d’étude et envoyés." />
      <form
        role="search"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get('q') ?? '').trim();
          update({ q: value || undefined, page: undefined });
        }}
      >
        <TextField
          key={q}
          name="q"
          type="search"
          label="Rechercher"
          placeholder="Référence, nom, email, entreprise"
          defaultValue={q}
          containerClassName="flex-1"
        />
        <SelectField
          label="Statut"
          placeholder="Tous"
          options={statusOptions}
          value={status}
          containerClassName="sm:w-52"
          onChange={(e) => update({ statut: e.target.value || undefined, page: undefined })}
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
          caption="Liste des devis"
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => row.id}
          loading={query.isPending}
          emptyTitle="Aucun devis"
          emptyDescription="Les demandes faites sur le site apparaîtront ici."
        />
      )}
      {query.data && pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <p className="text-body-sm text-ink-muted">
            Page {page} sur {pages} · {query.data.total} devis
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => update({ page: String(page + 1) })}
            >
              Suivant
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}
