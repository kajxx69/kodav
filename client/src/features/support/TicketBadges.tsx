import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type TicketDto,
  type TicketPriority,
  type TicketStatus,
} from '@kodav/shared';
import { Clock } from 'lucide-react';
import { Badge } from '~/components/ui';
import { cn } from '~/lib/cn';
import { useNow } from '~/lib/useNow';

const STATUS_VARIANT: Record<TicketStatus, 'info' | 'gold' | 'warning' | 'success' | 'neutral'> = {
  ouvert: 'info',
  en_cours: 'gold',
  attente_client: 'warning',
  resolu: 'success',
  ferme: 'neutral',
};

export function TicketStatusBadge({
  status,
  staff = false,
}: {
  status: TicketStatus;
  staff?: boolean;
}) {
  const label =
    staff && status === 'attente_client' ? 'Attente client' : TICKET_STATUS_LABELS[status];
  return <Badge variant={STATUS_VARIANT[status]}>{label}</Badge>;
}

const PRIORITY_VARIANT: Record<TicketPriority, 'neutral' | 'info' | 'warning' | 'danger'> = {
  basse: 'neutral',
  normale: 'info',
  haute: 'warning',
  critique: 'danger',
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]}>
      Priorité {TICKET_PRIORITY_LABELS[priority].toLowerCase()}
    </Badge>
  );
}

function duration(ms: number) {
  const h = Math.round(Math.abs(ms) / 3_600_000);
  if (h < 1) return 'moins d’1 h';
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} j`;
}

/**
 * Délai cible : vert tant qu'il reste plus d'un quart du temps, orange ensuite, rouge
 * une fois dépassé. Ticket résolu : délai tenu ou non.
 */
export function SlaIndicator({
  ticket,
  className,
}: {
  ticket: Pick<TicketDto, 'slaDueAt' | 'slaHours' | 'resolvedAt' | 'status' | 'createdAt'>;
  className?: string;
}) {
  const now = useNow();
  const due = new Date(ticket.slaDueAt).getTime();
  const done = ['resolu', 'ferme'].includes(ticket.status) && ticket.resolvedAt;
  let tone: 'ok' | 'warn' | 'late';
  let label: string;
  if (done) {
    const met = new Date(ticket.resolvedAt!).getTime() <= due;
    tone = met ? 'ok' : 'late';
    label = met ? 'Délai cible tenu' : 'Résolu après le délai cible';
  } else {
    const left = due - now;
    const total = due - new Date(ticket.createdAt).getTime();
    tone = left < 0 ? 'late' : left < total / 4 ? 'warn' : 'ok';
    label =
      left < 0 ? `Délai dépassé de ${duration(left)}` : `Délai cible : ${duration(left)} restantes`;
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-caption',
        tone === 'ok' && 'text-success',
        tone === 'warn' && 'text-warning',
        tone === 'late' && 'text-danger',
        className,
      )}
      title={`Objectif : ${ticket.slaHours} h ouvrées`}
    >
      <Clock className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
