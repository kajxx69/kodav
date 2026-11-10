import { QUOTE_STATUS_LABELS, type Paginated, type QuoteDto } from '@kodav/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, FileText, LifeBuoy, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import { Alert, Button, Card, Skeleton } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { useAuthStore } from '~/stores/auth';

function SummaryCard({
  icon: Icon,
  title,
  empty,
  to,
  linkLabel,
}: {
  icon: LucideIcon;
  title: string;
  empty: ReactNode;
  to: string;
  linkLabel: string;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-slate dark:text-link">
          <Icon className="size-5" aria-hidden />
        </span>
        <h2 className="text-h4">{title}</h2>
      </div>
      <div className="flex-1 text-body-sm text-ink-muted">{empty}</div>
      <Link to={to} className="text-label text-link underline">
        {linkLabel}
      </Link>
    </Card>
  );
}

/** Devis en cours : demandes reçues, en étude ou envoyées en attente de réponse. */
function OpenQuotes() {
  const query = useQuery({
    queryKey: ['private', 'quotes', { open: true }],
    queryFn: () => apiRequest<Paginated<QuoteDto>>('/quotes?limit=20'),
  });
  if (query.isPending) return <Skeleton className="h-12" />;
  if (query.isError) return <p>Impossible de charger vos devis.</p>;
  const open = query.data.items.filter((q) => ['soumis', 'en_revue', 'envoye'].includes(q.status));
  if (!open.length)
    return <p>Aucun devis en cours. Vos demandes apparaîtront ici avec leur statut.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {open.slice(0, 3).map((q) => (
        <li key={q.id}>
          <Link
            to={`/espace-client/devis/${q.id}`}
            className="flex justify-between gap-2 hover:text-ink"
          >
            <span className="text-ink">{q.reference}</span>
            <span>{QUOTE_STATUS_LABELS[q.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ClientDashboard() {
  const user = useAuthStore((s) => s.user);
  const welcome = (useLocation().state as { welcome?: boolean } | null)?.welcome;
  if (!user) return null;
  return (
    <>
      <SpaceHeader
        title={`Bonjour ${user.firstName}`}
        lead={
          user.organization ? `Compte ${user.organization.name}` : 'Bienvenue dans votre espace.'
        }
        actions={
          <>
            <Button asChild>
              <Link to="/devis">Demander un devis</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/rendez-vous">Prendre rendez-vous</Link>
            </Button>
          </>
        }
      />
      {welcome && (
        <Alert variant="success" title="Votre compte est créé">
          Vous pourrez suivre ici vos devis, vos rendez-vous et vos demandes de support.
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={FileText}
          title="Devis en cours"
          empty={<OpenQuotes />}
          to="/espace-client/devis"
          linkLabel="Voir mes devis"
        />
        <SummaryCard
          icon={CalendarClock}
          title="Prochain rendez-vous"
          empty="Aucun rendez-vous planifié."
          to="/espace-client/rendez-vous"
          linkLabel="Voir mes rendez-vous"
        />
        <SummaryCard
          icon={LifeBuoy}
          title="Tickets ouverts"
          empty="Aucune demande de support en cours."
          to="/espace-client/tickets"
          linkLabel="Accéder au support"
        />
      </div>
    </>
  );
}
