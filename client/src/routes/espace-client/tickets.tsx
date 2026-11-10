import type { Paginated, TicketDto } from '@kodav/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from '~/components/ui';
import { TicketList } from '~/features/support/TicketList';
import { apiRequest } from '~/lib/api';
import { useTicketsLive } from '~/lib/realtime';

export default function ClientTickets() {
  const [params, setParams] = useSearchParams();
  const view = params.get('vue') === 'tous' ? 'tous' : 'ouverts';
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['private', 'tickets', view],
    queryFn: () =>
      apiRequest<Paginated<TicketDto>>(`/tickets${view === 'ouverts' ? '?open=true' : ''}`),
  });
  useTicketsLive(() => void queryClient.invalidateQueries({ queryKey: ['private', 'tickets'] }));
  return (
    <>
      <SpaceHeader
        title="Support"
        lead="Vos demandes d’assistance et les échanges avec notre équipe."
        actions={
          <Button asChild>
            <Link to="/espace-client/tickets/nouveau">Nouvelle demande</Link>
          </Button>
        }
      />
      <Tabs
        value={view}
        onValueChange={(v) => setParams(v === 'tous' ? { vue: 'tous' } : {}, { replace: true })}
      >
        <TabsList aria-label="Filtre">
          <TabsTrigger value="ouverts">En cours</TabsTrigger>
          <TabsTrigger value="tous">Toutes</TabsTrigger>
        </TabsList>
      </Tabs>
      {query.isPending ? (
        <div className="grid gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={view === 'ouverts' ? 'Aucune demande en cours' : 'Aucune demande'}
          description="Un souci avec un poste, un logiciel ou le réseau ? Décrivez-le, nous vous répondons ici."
        />
      ) : (
        <TicketList items={query.data.items} basePath="/espace-client/tickets" />
      )}
    </>
  );
}
