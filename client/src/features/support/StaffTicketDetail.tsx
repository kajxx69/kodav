import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  type TicketDetailDto,
} from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import { Button, Card, ErrorState, SelectField, Skeleton, toast } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { formatDateTime } from '~/lib/format';
import { useAuthStore } from '~/stores/auth';
import { PriorityBadge, SlaIndicator, TicketStatusBadge } from './TicketBadges';
import { TicketConversation } from './TicketConversation';

type Member = { id: string; name: string; role: string };

/** Fiche ticket côté équipe : conversation, notes internes et pilotage du ticket. */
export function StaffTicketDetail({ backTo, backLabel }: { backTo: string; backLabel: string }) {
  const { id = '' } = useParams();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const key = ['private', 'staff-tickets', 'detail', id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<TicketDetailDto>(`/tickets/${encodeURIComponent(id)}`),
  });
  const team = useQuery({
    queryKey: ['private', 'admin', 'team'],
    queryFn: () => apiRequest<Member[]>('/admin/tickets/team'),
    enabled: isAdmin,
  });
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest<TicketDetailDto>(`/admin/tickets/${id}`, { method: 'PATCH', json: body }),
    onSuccess(t) {
      queryClient.setQueryData(key, t);
      void queryClient.invalidateQueries({
        queryKey: ['private', 'staff-tickets'],
        exact: false,
        refetchType: 'none',
      });
    },
    onError(err) {
      toast('Modification impossible', { description: err.message, variant: 'error' });
    },
  });

  const back = (
    <Link to={backTo} className="inline-flex items-center gap-1 text-label text-link">
      <ArrowLeft className="size-4" aria-hidden />
      {backLabel}
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
  const statuses = isAdmin ? TICKET_STATUSES : (['en_cours', 'attente_client', 'resolu'] as const);
  return (
    <>
      {back}
      <SpaceHeader
        title={t.subject}
        lead={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t.reference}</span>
            <TicketStatusBadge status={t.status} staff />
            <PriorityBadge priority={t.priority} />
          </span>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <TicketConversation ticket={t} queryKey={key} staff />
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <h2 className="text-h4">Suivi</h2>
            <SlaIndicator ticket={t} />
            <SelectField
              label="Statut"
              value={t.status}
              disabled={update.isPending || (!isAdmin && t.status === 'ferme')}
              options={
                (statuses as readonly string[]).includes(t.status)
                  ? statuses.map((s) => ({ value: s, label: TICKET_STATUS_LABELS[s] }))
                  : [
                      { value: t.status, label: TICKET_STATUS_LABELS[t.status] },
                      ...statuses.map((s) => ({ value: s, label: TICKET_STATUS_LABELS[s] })),
                    ]
              }
              onChange={(e) => update.mutate({ status: e.target.value })}
            />
            {isAdmin && (
              <>
                <SelectField
                  label="Priorité"
                  value={t.priority}
                  disabled={update.isPending}
                  help="Le délai cible est recalculé."
                  options={TICKET_PRIORITIES.map((p) => ({
                    value: p,
                    label: TICKET_PRIORITY_LABELS[p],
                  }))}
                  onChange={(e) => update.mutate({ priority: e.target.value })}
                />
                <SelectField
                  label="Assigné à"
                  placeholder="Personne"
                  value={t.assignee?.id ?? ''}
                  disabled={update.isPending}
                  options={(team.data ?? []).map((m) => ({
                    value: m.id,
                    label: `${m.name}${m.role === 'admin' ? ' (admin)' : ''}`,
                  }))}
                  onChange={(e) => update.mutate({ assignee: e.target.value || null })}
                />
              </>
            )}
            {!isAdmin && t.assignee && (
              <p className="text-body-sm text-ink-muted">Assigné à {t.assignee.name}</p>
            )}
          </Card>
          <Card className="flex flex-col gap-3 text-body-sm">
            <h2 className="text-h4">Client</h2>
            {t.client && (
              <>
                <p className="text-ink">
                  {t.client.name}
                  {t.client.organization && (
                    <span className="block text-ink-muted">{t.client.organization}</span>
                  )}
                </p>
                <Button asChild variant="outline" size="sm" className="self-start">
                  <a href={`mailto:${t.client.email}?subject=${encodeURIComponent(t.reference)}`}>
                    <Mail aria-hidden />
                    {t.client.email}
                  </a>
                </Button>
              </>
            )}
            <dl className="grid gap-2">
              <div>
                <dt className="text-caption text-ink-muted">Catégorie</dt>
                <dd>{TICKET_CATEGORY_LABELS[t.category]}</dd>
              </div>
              {t.asset && (
                <div>
                  <dt className="text-caption text-ink-muted">Équipement</dt>
                  <dd>{t.asset.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-caption text-ink-muted">Ouvert le</dt>
                <dd>{formatDateTime(t.createdAt)}</dd>
              </div>
              {t.satisfaction && (
                <div>
                  <dt className="text-caption text-ink-muted">Satisfaction</dt>
                  <dd>
                    {t.satisfaction.rating}/5
                    {t.satisfaction.comment ? ` · ${t.satisfaction.comment}` : ''}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
