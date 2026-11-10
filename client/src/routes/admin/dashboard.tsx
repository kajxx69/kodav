import { formatFcfa, type AdminOverview, type DashboardDto } from '@kodav/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarDays, FileText, Inbox, Percent, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import { ColumnChart } from '~/components/charts/ColumnChart';
import { Alert, Card, ErrorState, Skeleton, Tabs, TabsList, TabsTrigger } from '~/components/ui';
import { apiRequest } from '~/lib/api';

const PERIODS = [
  { value: '30', label: '30 jours' },
  { value: '90', label: '90 jours' },
  { value: '365', label: '12 mois' },
] as const;

const number = new Intl.NumberFormat('fr-FR');
/** « 1,2 M », « 450 k » : graduations courtes en FCFA. */
const compact = (v: number) =>
  v >= 1_000_000
    ? `${number.format(Math.round(v / 100_000) / 10)} M`
    : v >= 1000
      ? `${number.format(Math.round(v / 1000))} k`
      : number.format(v);

function bucketLabel(key: string, period: number) {
  if (period === 365) {
    return new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(
      new Date(`${key}-01T00:00:00Z`),
    );
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${key}T00:00:00Z`));
}

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  to,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-body-sm text-ink-muted">
        {Icon && <Icon className="size-4" aria-hidden />}
        {label}
      </span>
      <span className="text-h2 text-ink tabular-nums">{value}</span>
      {hint && <span className="text-caption text-ink-muted">{hint}</span>}
    </>
  );
  return (
    <Card interactive={Boolean(to)} className="p-0">
      {to ? (
        <Link to={to} className="flex h-full flex-col gap-1 p-5">
          {body}
        </Link>
      ) : (
        <div className="flex h-full flex-col gap-1 p-5">{body}</div>
      )}
    </Card>
  );
}

const PRIORITIES = [
  { key: 'critique', label: 'Critique' },
  { key: 'haute', label: 'Haute' },
  { key: 'normale', label: 'Normale' },
  { key: 'basse', label: 'Basse' },
] as const;

/** Tickets ouverts par priorité : barres horizontales d'une seule couleur, valeur à côté. */
function PriorityBars({ counts }: { counts: DashboardDto['kpis']['openTickets'] }) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <ul className="flex flex-col gap-3">
      {PRIORITIES.map((p) => (
        <li key={p.key}>
          <Link
            to={`/admin/tickets?priorite=${p.key}`}
            className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-body-sm hover:text-ink"
          >
            <span className="text-ink-muted">{p.label}</span>
            <span className="h-3 rounded-r-sm bg-surface-sunken" aria-hidden>
              <span
                className="block h-full rounded-r-sm"
                style={{ width: `${(counts[p.key] / max) * 100}%`, background: 'var(--chart-1)' }}
              />
            </span>
            <span className="text-right text-ink tabular-nums">{counts[p.key]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function AdminDashboard() {
  const [period, setPeriod] = useState<string>('30');
  const query = useQuery({
    queryKey: ['private', 'admin', 'dashboard', period],
    queryFn: () => apiRequest<DashboardDto>(`/admin/dashboard?period=${period}`),
    placeholderData: keepPreviousData,
  });
  const overview = useQuery({
    queryKey: ['private', 'admin', 'overview'],
    queryFn: () => apiRequest<AdminOverview>('/admin/overview'),
  });
  const d = query.data;
  const points = (pick: (s: DashboardDto['series'][number]) => number[]) =>
    d?.series.map((s) => ({
      key: s.date,
      label: bucketLabel(s.date, d.period),
      values: pick(s),
    })) ?? [];
  const openTotal = d ? Object.values(d.kpis.openTickets).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <SpaceHeader
        title="Tableau de bord"
        lead="L’activité en un coup d’œil. Les montants portent sur les factures émises dans la période."
        actions={
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList aria-label="Période">
              {PERIODS.map((p) => (
                <TabsTrigger key={p.value} value={p.value}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      {overview.data && overview.data.placeholderPrices > 0 && (
        <Alert
          variant="warning"
          title={`${overview.data.placeholderPrices} tarifs d’exemple à remplacer`}
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
      {query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : !d ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              icon={FileText}
              label="Devis à traiter"
              value={d.kpis.pendingQuotes}
              to="/admin/devis?statut=soumis"
            />
            <Tile
              icon={CalendarDays}
              label="Interventions aujourd’hui"
              value={d.kpis.appointmentsToday}
              to="/admin/planning"
            />
            <Tile
              icon={Inbox}
              label="Nouveaux prospects"
              value={d.kpis.newLeads}
              to="/admin/prospects"
            />
            <Tile
              icon={Percent}
              label="Taux d’acceptation des devis"
              value={d.kpis.acceptanceRate === null ? '—' : `${d.kpis.acceptanceRate} %`}
              hint={
                d.kpis.acceptanceRate === null
                  ? 'Aucune réponse sur la période'
                  : 'Acceptés parmi les devis tranchés'
              }
            />
            <Tile
              label="Facturé"
              value={formatFcfa(d.kpis.invoiced)}
              hint={`Sur ${PERIODS.find((p) => p.value === period)!.label}`}
              to="/admin/factures"
            />
            <Tile label="Encaissé" value={formatFcfa(d.kpis.collected)} />
            <Tile
              label="Reste à encaisser"
              value={formatFcfa(d.kpis.outstanding)}
              to="/admin/factures?statut=impayee"
            />
            <Tile label="Tickets ouverts" value={openTotal} to="/admin/tickets" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="flex flex-col gap-3">
              <h2 className="text-h4">Chiffre d’affaires facturé</h2>
              <ColumnChart
                caption="Chiffre d’affaires facturé par période"
                series={[{ name: 'Facturé', color: 'var(--chart-1)' }]}
                data={points((s) => [s.invoiced])}
                format={(v) => formatFcfa(v)}
                formatAxis={compact}
              />
            </Card>
            <Card className="flex flex-col gap-3">
              <h2 className="text-h4">Devis reçus et acceptés</h2>
              <ColumnChart
                caption="Demandes de devis reçues et devis acceptés par période"
                series={[
                  { name: 'Reçus', color: 'var(--chart-1)' },
                  { name: 'Acceptés', color: 'var(--chart-2)' },
                ]}
                data={points((s) => [s.quotes, s.accepted])}
                format={(v) => number.format(v)}
                integer
              />
            </Card>
            <Card className="flex flex-col gap-3">
              <h2 className="text-h4">Tickets ouverts</h2>
              <ColumnChart
                caption="Tickets de support ouverts par période"
                series={[{ name: 'Tickets', color: 'var(--chart-1)' }]}
                data={points((s) => [s.tickets])}
                format={(v) => number.format(v)}
                integer
              />
            </Card>
            <Card className="flex flex-col gap-4">
              <h2 className="text-h4">Tickets en cours par priorité</h2>
              <PriorityBars counts={d.kpis.openTickets} />
              <Link to="/admin/tickets" className="self-start text-label text-link underline">
                Voir les tickets
              </Link>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
