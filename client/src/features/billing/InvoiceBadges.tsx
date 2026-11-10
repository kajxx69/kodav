import { INVOICE_STATUS_LABELS, type InvoiceStatus } from '@kodav/shared';
import { Badge } from '~/components/ui';

const VARIANT: Record<InvoiceStatus, 'warning' | 'info' | 'success' | 'neutral'> = {
  impayee: 'warning',
  partielle: 'info',
  payee: 'success',
  annulee: 'neutral',
};

export function InvoiceStatusBadge({
  status,
  overdue,
}: {
  status: InvoiceStatus;
  overdue?: boolean;
}) {
  return (
    <>
      <Badge variant={VARIANT[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>
      {overdue && <Badge variant="danger">Échue</Badge>}
    </>
  );
}
