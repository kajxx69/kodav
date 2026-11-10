import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  formatFcfa,
  type InvoiceDto,
  type Paginated,
} from '@kodav/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
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
import { InvoiceStatusBadge } from '~/features/billing/InvoiceBadges';
import { downloadProtectedFile, apiRequest } from '~/lib/api';
import { formatDate } from '~/lib/format';

const columns: Column<InvoiceDto>[] = [
  {
    key: 'reference',
    header: 'Référence',
    cell: (i) => (
      <Link to={`/admin/factures/${i.id}`} className="text-label text-link underline">
        {i.reference}
      </Link>
    ),
    sortValue: (i) => i.reference,
  },
  {
    key: 'client',
    header: 'Client',
    cell: (i) => i.billing.company || i.billing.name,
    sortValue: (i) => i.billing.company || i.billing.name,
  },
  {
    key: 'issued',
    header: 'Émise le',
    cell: (i) => formatDate(i.issuedAt),
    sortValue: (i) => i.issuedAt,
  },
  { key: 'due', header: 'Échéance', cell: (i) => formatDate(i.dueAt), sortValue: (i) => i.dueAt },
  {
    key: 'total',
    header: 'Total',
    cell: (i) => formatFcfa(i.total),
    sortValue: (i) => i.total,
    className: 'text-right tabular-nums',
  },
  {
    key: 'paid',
    header: 'Réglé',
    cell: (i) => formatFcfa(i.paid),
    sortValue: (i) => i.paid,
    className: 'text-right tabular-nums',
  },
  {
    key: 'status',
    header: 'Statut',
    cell: (i) => <InvoiceStatusBadge status={i.status} overdue={i.overdue} />,
  },
];

export default function AdminInvoices() {
  const [params, setParams] = useSearchParams();
  const status = params.get('statut') ?? '';
  const q = params.get('q') ?? '';
  const query = useQuery({
    queryKey: ['private', 'admin', 'invoices', { status, q }],
    queryFn: () => {
      const qs = new URLSearchParams({ limit: '100' });
      if (status) qs.set('status', status);
      if (q) qs.set('q', q);
      return apiRequest<Paginated<InvoiceDto>>(`/admin/invoices?${qs}`);
    },
    placeholderData: keepPreviousData,
  });
  const items = query.data?.items ?? [];
  const totals = items
    .filter((i) => i.status !== 'annulee')
    .reduce((acc, i) => ({ total: acc.total + i.total, paid: acc.paid + i.paid }), {
      total: 0,
      paid: 0,
    });

  return (
    <>
      <SpaceHeader
        title="Factures"
        lead="Factures émises depuis les devis acceptés et règlements reçus (espèces, virement, Mobile Money, chèque)."
        actions={
          <Button
            variant="outline"
            onClick={() => void downloadProtectedFile('/admin/export/factures.csv')}
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
          setParams(
            { ...(status && { statut: status }), ...(value && { q: value }) },
            { replace: true },
          );
        }}
      >
        <TextField
          key={q}
          name="q"
          type="search"
          label="Rechercher"
          placeholder="Référence ou client"
          defaultValue={q}
          containerClassName="flex-1"
        />
        <SelectField
          label="Statut"
          placeholder="Tous"
          value={status}
          containerClassName="sm:w-56"
          options={INVOICE_STATUSES.map((s) => ({ value: s, label: INVOICE_STATUS_LABELS[s] }))}
          onChange={(e) =>
            setParams(
              { ...(e.target.value && { statut: e.target.value }), ...(q && { q }) },
              { replace: true },
            )
          }
        />
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          Rechercher
        </Button>
      </form>
      {query.data && items.length > 0 && (
        <p className="text-body-sm text-ink-muted">
          {items.length} facture{items.length > 1 ? 's' : ''} · facturé {formatFcfa(totals.total)} ·
          réglé {formatFcfa(totals.paid)} · reste {formatFcfa(totals.total - totals.paid)}
        </p>
      )}
      {query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption="Liste des factures"
          columns={columns}
          rows={query.data?.items}
          rowKey={(i) => i.id}
          loading={query.isPending}
          emptyTitle="Aucune facture"
          emptyDescription="Ouvrez un devis accepté et cliquez sur « Facturer »."
        />
      )}
    </>
  );
}
