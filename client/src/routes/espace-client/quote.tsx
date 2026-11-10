import type { QuoteDto } from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileDown } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import { Button, Card, ErrorState, Skeleton, toast } from '~/components/ui';
import {
  QuoteDecision,
  QuoteInfo,
  QuoteLines,
  QuoteStatusBadge,
  QuoteTimeline,
} from '~/features/quote/QuoteView';
import { apiRequest, openProtectedFile } from '~/lib/api';

export default function ClientQuote() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['private', 'quotes', id],
    queryFn: () => apiRequest<QuoteDto>(`/quotes/${encodeURIComponent(id)}`),
  });
  const decision = useMutation({
    mutationFn: (input: { decision: 'accept' | 'decline'; reason: string }) =>
      apiRequest<QuoteDto>(`/quotes/${encodeURIComponent(id)}/decision`, {
        method: 'POST',
        json: input,
      }),
    onSuccess(quote) {
      queryClient.setQueryData(['private', 'quotes', id], quote);
      void queryClient.invalidateQueries({ queryKey: ['private', 'quotes'], exact: false });
    },
  });

  const back = (
    <Link to="/espace-client/devis" className="inline-flex items-center gap-1 text-label text-link">
      <ArrowLeft className="size-4" aria-hidden />
      Mes devis
    </Link>
  );

  if (query.isPending) {
    return (
      <>
        {back}
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
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
  return (
    <>
      {back}
      <SpaceHeader
        title={`Devis ${quote.reference}`}
        lead={<QuoteStatusBadge status={quote.status} />}
        actions={
          <Button
            variant="outline"
            onClick={() =>
              openProtectedFile(`/quotes/${quote.id}/pdf`).catch((err: Error) =>
                toast('Téléchargement impossible', { description: err.message, variant: 'error' }),
              )
            }
          >
            <FileDown aria-hidden />
            PDF
          </Button>
        }
      />
      <QuoteDecision
        quote={quote}
        pending={decision.isPending}
        error={decision.error?.message ?? null}
        onDecide={(d, reason) => decision.mutate({ decision: d, reason })}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <h2 className="text-h4">Détail</h2>
            <QuoteLines quote={quote} />
          </Card>
          <Card className="flex flex-col gap-4">
            <h2 className="text-h4">Informations</h2>
            <QuoteInfo quote={quote} />
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
