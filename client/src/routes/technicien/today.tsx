import type { AppointmentDto } from '@kodav/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, ChevronRight, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '~/components/ui';
import { AppointmentStatusBadge } from '~/features/appointments/AppointmentView';
import { apiRequest } from '~/lib/api';
import { useStaffLive } from '~/lib/realtime';
import { useAuthStore } from '~/stores/auth';

const TZ = 'Africa/Abidjan';
const today = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});
const hour = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const day = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});

function InterventionList({ range }: { range: 'day' | 'week' }) {
  const query = useQuery({
    queryKey: ['private', 'technician', range],
    queryFn: () => apiRequest<AppointmentDto[]>(`/technician/appointments?range=${range}`),
  });
  if (query.isPending) {
    return (
      <div className="grid gap-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  if (!query.data.length) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title={
          range === 'day' ? 'Aucune intervention aujourd’hui' : 'Aucune intervention cette semaine'
        }
        description="Les interventions qui vous sont assignées apparaîtront ici, avec l’itinéraire et le rapport à remplir."
      />
    );
  }
  const labels = query.data.map((a) => day.format(new Date(a.start)));
  return (
    <ul className="flex flex-col gap-3">
      {query.data.map((a, i) => {
        const heading = range === 'week' && labels[i] !== labels[i - 1] ? labels[i] : null;
        return (
          <li key={a.id} className="flex flex-col gap-2">
            {heading && (
              <h3 className="mt-2 text-label text-ink-muted first-letter:uppercase">{heading}</h3>
            )}
            <Card interactive className="p-0">
              <Link
                to={`/technicien/interventions/${a.id}`}
                className="flex items-center gap-4 p-4"
              >
                <span className="flex w-14 shrink-0 flex-col items-center rounded-md bg-surface-sunken py-2">
                  <span className="text-label text-ink tabular-nums">
                    {hour.format(new Date(a.start))}
                  </span>
                  <span className="text-caption text-ink-muted tabular-nums">
                    {hour.format(new Date(a.end))}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-label text-ink">{a.contact.name}</span>
                    <AppointmentStatusBadge status={a.status} />
                  </span>
                  <span className="truncate text-body-sm text-ink-muted">
                    {a.reference} · {a.service?.name ?? a.description}
                  </span>
                  {a.address.commune && (
                    <span className="flex items-center gap-1 text-caption text-ink-muted">
                      <MapPin className="size-3.5" aria-hidden />
                      {a.address.commune}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
              </Link>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export default function TechnicianToday() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  // Nouvelle affectation ou changement : la liste se met à jour seule.
  useStaffLive(() => void queryClient.invalidateQueries({ queryKey: ['private', 'technician'] }));
  return (
    <>
      <SpaceHeader
        title={`Bonjour ${user?.firstName ?? ''}`}
        lead={<span className="first-letter:uppercase">{today.format(new Date())}</span>}
      />
      <Tabs defaultValue="day">
        <TabsList aria-label="Période">
          <TabsTrigger value="day">Aujourd’hui</TabsTrigger>
          <TabsTrigger value="week">7 prochains jours</TabsTrigger>
        </TabsList>
        <TabsContent value="day">
          <InterventionList range="day" />
        </TabsContent>
        <TabsContent value="week">
          <InterventionList range="week" />
        </TabsContent>
      </Tabs>
    </>
  );
}
