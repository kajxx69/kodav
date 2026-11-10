import { QUOTE_STATUSES, QUOTE_STATUS_LABELS, type Paginated, type QuoteDto } from '@kodav/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import { Button, Card, EmptyState, ErrorState, SelectField, Skeleton } from '~/components/ui';
import { QuoteStatusBadge } from '~/features/quote/QuoteView';
import { apiRequest } from '~/lib/api';
import { formatDate, rangeLabel } from '~/lib/format';
import { formatFcfa } from '@kodav/shared';

const statusOptions = QUOTE_STATUSES.filter((s) => s !== 'brouillon').map((s) => ({
  value: s,
  label: QUOTE_STATUS_LABELS[s],
}));

function amount(quote: QuoteDto) {
  if (quote.finalTotals && quote.status !== 'soumis' && quote.status !== 'en_revue') {
    return formatFcfa(quote.finalTotals.total);
  }
  return quote.estimate.lines.every((l) => l.onQuote)
    ? 'Sur devis'
    : `≈ ${rangeLabel(quote.estimate.total)}`;
}

export default function ClientQuotes() {
  const [params, setParams] = useSearchParams();
  const status = params.get('statut') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const query = useQuery({
    queryKey: ['private', 'quotes', { status, page }],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), limit: '10' });
      if (status) qs.set('status', status);
      return apiRequest<Paginated<QuoteDto>>(`/quotes?${qs}`);
    },
    placeholderData: keepPreviousData,
  });
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / 10)) : 1;

  return (
    <>
      <SpaceHeader
        title="Mes devis"
        lead="Vos demandes et les devis reçus, avec leur suivi."
        actions={
          <Button asChild>
            <Link to="/devis">Nouvelle demande</Link>
          </Button>
        }
      />
      <SelectField
        label="Statut"
        placeholder="Tous"
        options={statusOptions}
        value={status}
        containerClassName="sm:w-64"
        onChange={(e) =>
          setParams(e.target.value ? { statut: e.target.value } : {}, { replace: true })
        }
      />
      {query.isPending ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={status ? 'Aucun devis avec ce statut' : 'Aucune demande de devis'}
          description="Composez votre demande en ligne : l’estimation est immédiate."
          action={
            !status && (
              <Button asChild variant="secondary">
                <Link to="/devis">Demander un devis</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3">
          {query.data.items.map((quote) => (
            <li key={quote.id}>
              <Card interactive className="p-0">
                <Link
                  to={`/espace-client/devis/${quote.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-5"
                >
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className="text-label text-ink">{quote.reference}</span>
                      <QuoteStatusBadge status={quote.status} />
                    </span>
                    <span className="text-body-sm text-ink-muted">
                      {quote.estimate.lines.map((l) => l.name).join(', ')}
                    </span>
                    <span className="text-caption text-ink-muted">
                      Demande du {formatDate(quote.submittedAt)}
                    </span>
                  </span>
                  <span className="text-label text-ink tabular-nums">{amount(quote)}</span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {query.data && pages > 1 && (
        <nav aria-label="Pagination" className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setParams({ ...(status && { statut: status }), page: String(page - 1) })}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setParams({ ...(status && { statut: status }), page: String(page + 1) })}
          >
            Suivant
          </Button>
        </nav>
      )}
    </>
  );
}
