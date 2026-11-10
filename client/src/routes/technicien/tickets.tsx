import type { Paginated, TicketDto } from '@kodav/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy } from 'lucide-react';
import { SpaceHeader } from '~/components/app/AppShell';
import { EmptyState, ErrorState, Skeleton } from '~/components/ui';
import { TicketList } from '~/features/support/TicketList';
import { apiRequest } from '~/lib/api';
import { useTicketsLive } from '~/lib/realtime';

export default function TechnicianTickets() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['private', 'staff-tickets', 'mine'],
    queryFn: () => apiRequest<Paginated<TicketDto>>('/tickets?open=true'),
  });
  useTicketsLive(
    () => void queryClient.invalidateQueries({ queryKey: ['private', 'staff-tickets'] }),
  );
  return (
    <>
      <SpaceHeader
        title="Tickets assignés"
        lead="Les demandes de support qui vous sont confiées, les plus récentes en premier."
      />
      {query.isPending ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Aucun ticket assigné"
          description="Les tickets que l’administrateur vous confie apparaîtront ici."
        />
      ) : (
        <TicketList items={query.data.items} basePath="/technicien/tickets" staff />
      )}
    </>
  );
}
