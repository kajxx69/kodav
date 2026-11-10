import type { AdminOverview } from '@kodav/shared';
import { useQuery } from '@tanstack/react-query';
import { HardHat, Inbox, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import { Alert, Card, ErrorState, Skeleton } from '~/components/ui';
import { apiRequest } from '~/lib/api';

function Stat({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  to?: string;
}) {
  const content = (
    <>
      <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-slate dark:text-link">
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <span className="block text-h3 text-ink tabular-nums">{value}</span>
        <span className="block text-body-sm text-ink-muted">{label}</span>
      </span>
    </>
  );
  return (
    <Card interactive={Boolean(to)} className="p-5">
      {to ? (
        <Link to={to} className="flex items-center gap-4">
          {content}
        </Link>
      ) : (
        <div className="flex items-center gap-4">{content}</div>
      )}
    </Card>
  );
}

export default function AdminDashboard() {
  const query = useQuery({
    queryKey: ['private', 'admin', 'overview'],
    queryFn: () => apiRequest<AdminOverview>('/admin/overview'),
  });

  return (
    <>
      <SpaceHeader
        title="Tableau de bord"
        lead="Vue d’ensemble de l’activité. Les indicateurs détaillés (devis, chiffre d’affaires, graphiques) arrivent avec les modules correspondants."
      />
      {query.data && query.data.placeholderPrices > 0 && (
        <Alert
          variant="warning"
          title={`${query.data.placeholderPrices} tarifs d’exemple à remplacer`}
          action={
            <Link to="/admin/catalogue" className="text-label text-link underline">
              Ouvrir le catalogue
            </Link>
          }
        >
          Les prix affichés sur le site sont des valeurs d’exemple issues de l’installation. Mettez
          à jour vos tarifs réels avant la mise en ligne.
        </Alert>
      )}
      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={Inbox}
            label="Nouveaux prospects"
            value={query.data.newLeads}
            to="/admin/prospects"
          />
          <Stat
            icon={Users}
            label="Clients"
            value={query.data.users.client}
            to="/admin/utilisateurs?role=client"
          />
          <Stat
            icon={HardHat}
            label="Techniciens"
            value={query.data.users.technicien}
            to="/admin/utilisateurs?role=technicien"
          />
          <Stat
            icon={ShieldCheck}
            label="Administrateurs"
            value={query.data.users.admin}
            to="/admin/utilisateurs?role=admin"
          />
        </div>
      )}
    </>
  );
}
