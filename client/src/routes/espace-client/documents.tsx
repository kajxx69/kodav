import { useQuery } from '@tanstack/react-query';
import { FileText, FolderOpen, ReceiptText, Wrench, type LucideIcon } from 'lucide-react';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '~/components/ui';
import { InvoiceStatusBadge } from '~/features/billing/InvoiceBadges';
import { apiRequest, openProtectedFile } from '~/lib/api';
import { formatDate } from '~/lib/format';
import type { InvoiceStatus } from '@kodav/shared';
import { QUOTE_STATUS_LABELS, formatFcfa, type QuoteStatus } from '@kodav/shared';

type DocumentRow = {
  kind: 'facture' | 'devis' | 'rapport';
  id: string;
  reference: string;
  date: string;
  detail: string;
  status: string;
  pdf: string;
};

const KINDS: Record<DocumentRow['kind'], { label: string; icon: LucideIcon }> = {
  facture: { label: 'Facture', icon: ReceiptText },
  devis: { label: 'Devis', icon: FileText },
  rapport: { label: 'Rapport d’intervention', icon: Wrench },
};

function List({ rows }: { rows: DocumentRow[] }) {
  if (!rows.length) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Aucun document"
        description="Vos devis, rapports signés et factures apparaîtront ici."
      />
    );
  }
  return (
    <Card className="p-0">
      <ul className="divide-y divide-line">
        {rows.map((d) => {
          const { label, icon: Icon } = KINDS[d.kind];
          return (
            <li key={`${d.kind}-${d.id}`} className="flex flex-wrap items-center gap-4 p-4">
              <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-slate dark:text-link">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-label text-ink">
                    {label} {d.reference}
                  </span>
                  {d.kind === 'facture' && (
                    <InvoiceStatusBadge status={d.status as InvoiceStatus} />
                  )}
                  {d.kind === 'devis' && (
                    <Badge>{QUOTE_STATUS_LABELS[d.status as QuoteStatus] ?? d.status}</Badge>
                  )}
                </span>
                <span className="text-body-sm text-ink-muted">
                  {formatDate(d.date)}
                  {d.kind === 'facture' && ` · ${formatFcfa(Number(d.detail.replace(/\D/g, '')))}`}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openProtectedFile(d.pdf).catch((err: Error) =>
                    toast('Document indisponible', { description: err.message, variant: 'error' }),
                  )
                }
              >
                Ouvrir le PDF
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function ClientDocuments() {
  const query = useQuery({
    queryKey: ['private', 'documents'],
    queryFn: () => apiRequest<DocumentRow[]>('/documents'),
  });
  const rows = query.data ?? [];
  return (
    <>
      <SpaceHeader
        title="Mes documents"
        lead="Devis, rapports d’intervention signés et factures, au format PDF."
      />
      {query.isPending ? (
        <Skeleton className="h-64" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <Tabs defaultValue="tous">
          <TabsList aria-label="Type de document">
            <TabsTrigger value="tous">Tous ({rows.length})</TabsTrigger>
            <TabsTrigger value="facture">Factures</TabsTrigger>
            <TabsTrigger value="devis">Devis</TabsTrigger>
            <TabsTrigger value="rapport">Rapports</TabsTrigger>
          </TabsList>
          <TabsContent value="tous">
            <List rows={rows} />
          </TabsContent>
          {(['facture', 'devis', 'rapport'] as const).map((k) => (
            <TabsContent key={k} value={k}>
              <List rows={rows.filter((r) => r.kind === k)} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}
