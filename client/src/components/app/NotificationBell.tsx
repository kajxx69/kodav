import type { NotificationDto, NotificationList } from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button, Skeleton, toast } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { cn } from '~/lib/cn';
import { useNotificationsLive } from '~/lib/realtime';

const KEY = ['private', 'notifications'];
const relative = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });

function ago(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}

/** Cloche : notifications de l'utilisateur, mises à jour en direct (toast à l'arrivée). */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => apiRequest<NotificationList>('/notifications'),
    refetchInterval: 5 * 60_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
  const markAll = useMutation({
    mutationFn: () => apiRequest('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });

  useNotificationsLive((n) => {
    // Déjà sur la page concernée (ex. la conversation du ticket) : lue d'office, sans toast.
    if (n.link && n.link === pathname) {
      markRead.mutate(n.id);
      queryClient.setQueryData<NotificationList>(KEY, (old) =>
        old
          ? {
              ...old,
              items: [{ ...n, readAt: new Date().toISOString() }, ...old.items].slice(0, 30),
            }
          : old,
      );
      return;
    }
    queryClient.setQueryData<NotificationList>(KEY, (old) =>
      old ? { items: [n, ...old.items].slice(0, 30), unread: old.unread + 1 } : old,
    );
    toast(n.title, { description: n.body || undefined });
  });

  const unread = query.data?.unread ?? 0;
  const openItem = (n: NotificationDto) => {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread ? `Notifications : ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'
          }
        >
          <Bell className="size-5" aria-hidden />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 grid min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[0.6875rem] leading-[1.125rem] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 flex max-h-[min(32rem,80dvh)] w-[min(24rem,calc(100vw-2rem))] flex-col rounded-lg border border-line bg-surface-raised shadow-lg data-[state=open]:animate-[fade-in_120ms_ease-out]"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-label text-ink">Notifications</p>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>
                <CheckCheck aria-hidden />
                Tout marquer lu
              </Button>
            )}
          </div>
          <div className="overflow-y-auto">
            {query.isPending ? (
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : !query.data?.items.length ? (
              <p className="px-4 py-8 text-center text-body-sm text-ink-muted">
                Aucune notification.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {query.data.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-sunken',
                        !n.readAt && 'bg-info-soft/40',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          n.readAt ? 'bg-transparent' : 'bg-gold',
                        )}
                      />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-label text-ink">
                          {n.title}
                          {!n.readAt && <span className="sr-only"> (non lue)</span>}
                        </span>
                        {n.body && (
                          <span className="line-clamp-2 text-body-sm text-ink-muted">{n.body}</span>
                        )}
                        <span className="text-caption text-ink-muted">{ago(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
