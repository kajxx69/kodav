import type { AppointmentDto } from '@kodav/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '~/components/ui';
import { AppointmentStatusBadge } from '~/features/appointments/AppointmentView';
import { formatSlot } from '~/features/appointments/SlotPicker';
import { apiRequest } from '~/lib/api';

const appointmentsQuery = {
  queryKey: ['private', 'appointments'],
  queryFn: () => apiRequest<AppointmentDto[]>('/appointments'),
};

function List({ items }: { items: AppointmentDto[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((a) => (
        <li key={a.id}>
          <Card interactive className="p-0">
            <Link
              to={`/espace-client/rendez-vous/${a.id}`}
              className="flex flex-wrap items-center justify-between gap-3 p-5"
            >
              <span className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="text-label text-ink">{a.reference}</span>
                  <AppointmentStatusBadge status={a.status} />
                </span>
                <span className="text-body-sm text-ink first-letter:uppercase">
                  {formatSlot(a.start)}
                </span>
                <span className="text-caption text-ink-muted">
                  {a.service?.name ?? a.description}
                </span>
              </span>
              {a.technician && (
                <span className="text-body-sm text-ink-muted">
                  Technicien : {a.technician.firstName}
                </span>
              )}
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export default function ClientAppointments() {
  const query = useQuery(appointmentsQuery);
  // Heure figée au premier affichage : le tri à venir / historique reste stable.
  const [now] = useState(() => Date.now());
  const upcoming =
    query.data
      ?.filter(
        (a) =>
          !['validee', 'annulee', 'terminee'].includes(a.status) &&
          new Date(a.end).getTime() > now - 24 * 3600_000,
      )
      .reverse() ?? [];
  const past = query.data?.filter((a) => !upcoming.includes(a)) ?? [];
  return (
    <>
      <SpaceHeader
        title="Mes rendez-vous"
        lead="Vos interventions, leur suivi en temps réel et les rapports signés."
        actions={
          <Button asChild>
            <Link to="/rendez-vous">Prendre rendez-vous</Link>
          </Button>
        }
      />
      {query.isPending ? (
        <div className="grid gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Aucun rendez-vous"
          description="Réservez une intervention sur un créneau libre de notre planning."
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-h4">À venir</h2>
              <List items={upcoming} />
            </section>
          )}
          {past.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-h4">Historique</h2>
              <List items={past} />
            </section>
          )}
        </>
      )}
    </>
  );
}
