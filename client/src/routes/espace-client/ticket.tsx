import { TICKET_CATEGORY_LABELS, type TicketDetailDto } from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import { Alert, Button, Card, ErrorState, Skeleton, TextArea } from '~/components/ui';
import { PriorityBadge, SlaIndicator, TicketStatusBadge } from '~/features/support/TicketBadges';
import { TicketConversation } from '~/features/support/TicketConversation';
import { apiRequest } from '~/lib/api';
import { cn } from '~/lib/cn';

function Rating({
  ticket,
  onDone,
}: {
  ticket: TicketDetailDto;
  onDone: (t: TicketDetailDto) => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const rate = useMutation({
    mutationFn: () =>
      apiRequest<TicketDetailDto>(`/tickets/${ticket.id}/rate`, {
        method: 'POST',
        json: { rating, comment },
      }),
    onSuccess: onDone,
  });
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h4">Votre demande est résolue</h2>
        <p className="text-body-sm text-ink-muted">
          Notez notre intervention : cela clôt la demande. Le problème persiste ? Répondez
          simplement ci-dessous.
        </p>
      </div>
      <fieldset>
        <legend className="mb-2 text-label text-ink">Votre note</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} sur 5`}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
              className="rounded-md p-1 hover:bg-surface-sunken"
            >
              <Star
                className={cn('size-8', n <= rating ? 'fill-gold text-gold' : 'text-line')}
                aria-hidden
              />
            </button>
          ))}
        </div>
      </fieldset>
      <TextArea
        label="Un commentaire ? (facultatif)"
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      {rate.isError && <Alert variant="danger">{rate.error.message}</Alert>}
      <Button
        className="self-start"
        disabled={!rating}
        loading={rate.isPending}
        onClick={() => rate.mutate()}
      >
        Envoyer ma note
      </Button>
    </Card>
  );
}

export default function ClientTicket() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const key = ['private', 'tickets', 'detail', id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<TicketDetailDto>(`/tickets/${encodeURIComponent(id)}`),
  });
  const update = (t: TicketDetailDto) => {
    queryClient.setQueryData(key, t);
    void queryClient.invalidateQueries({
      queryKey: ['private', 'tickets'],
      exact: false,
      refetchType: 'none',
    });
  };
  const resolve = useMutation({
    mutationFn: () => apiRequest<TicketDetailDto>(`/tickets/${id}/resolve`, { method: 'POST' }),
    onSuccess: update,
  });

  const back = (
    <Link
      to="/espace-client/tickets"
      className="inline-flex items-center gap-1 text-label text-link"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Support
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
  const t = query.data;
  const open = ['ouvert', 'en_cours', 'attente_client'].includes(t.status);
  return (
    <>
      {back}
      <SpaceHeader
        title={t.subject}
        lead={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t.reference}</span>
            <TicketStatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} />
            <span className="text-body-sm">{TICKET_CATEGORY_LABELS[t.category]}</span>
            {t.asset && <span className="text-body-sm">· {t.asset.name}</span>}
          </span>
        }
        actions={
          open ? (
            <Button variant="outline" loading={resolve.isPending} onClick={() => resolve.mutate()}>
              Mon problème est réglé
            </Button>
          ) : undefined
        }
      />
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-ink-muted">
        <SlaIndicator ticket={t} />
        {t.assignee && <span>Pris en charge par {t.assignee.name}</span>}
      </p>
      {t.status === 'resolu' && !t.satisfaction && <Rating ticket={t} onDone={update} />}
      {t.satisfaction && (
        <Alert variant="success" title={`Merci pour votre note : ${t.satisfaction.rating}/5`}>
          {t.satisfaction.comment || 'Votre avis nous aide à progresser.'}
        </Alert>
      )}
      <TicketConversation ticket={t} queryKey={key} />
    </>
  );
}
