import { TICKET_CATEGORY_LABELS, type TicketDto } from '@kodav/shared';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, Card } from '~/components/ui';
import { formatDateTime } from '~/lib/format';
import { PriorityBadge, SlaIndicator, TicketStatusBadge } from './TicketBadges';

/** Liste de tickets en cartes (client et technicien). */
export function TicketList({
  items,
  basePath,
  staff = false,
}: {
  items: TicketDto[];
  basePath: string;
  staff?: boolean;
}) {
  return (
    <ul className="grid gap-3">
      {items.map((t) => (
        <li key={t.id}>
          <Card interactive className="p-0">
            <Link to={`${basePath}/${t.id}`} className="flex flex-col gap-2 p-5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-label text-ink">{t.reference}</span>
                <TicketStatusBadge status={t.status} staff={staff} />
                {(staff || t.priority === 'critique' || t.priority === 'haute') && (
                  <PriorityBadge priority={t.priority} />
                )}
                {t.unread > 0 && (
                  <Badge variant="gold">
                    <MessageSquare aria-hidden />
                    {t.unread} nouveau{t.unread > 1 ? 'x' : ''}
                  </Badge>
                )}
              </span>
              <span className="text-body text-ink">{t.subject}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
                <span>{TICKET_CATEGORY_LABELS[t.category]}</span>
                {staff && t.client && <span>{t.client.organization ?? t.client.name}</span>}
                {t.asset && <span>{t.asset.name}</span>}
                <span>Dernier échange : {formatDateTime(t.lastMessageAt)}</span>
                {!['resolu', 'ferme'].includes(t.status) && <SlaIndicator ticket={t} />}
              </span>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
