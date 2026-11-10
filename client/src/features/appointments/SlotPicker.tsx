import type { Slot, SlotDay } from '@kodav/shared';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, Skeleton } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { cn } from '~/lib/cn';

const TZ = 'Africa/Abidjan';
const dayName = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: TZ });
const dayNumber = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: TZ,
});
const hour = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const longDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});

export const formatSlot = (iso: string) =>
  `${longDate.format(new Date(iso))} à ${hour.format(new Date(iso))}`;

/** « aujourd'hui 14:00 », « demain 9:00 » ou « jeudi 19 novembre à 9:00 ». */
export function relativeSlot(iso: string, now = new Date()) {
  const date = new Date(iso);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 3600_000);
  const time = hour.format(date).replace(':00', 'h').replace(':', 'h').replace(/^0/, '');
  if (day(date) === day(now)) return `aujourd’hui ${time}`;
  if (day(date) === day(tomorrow)) return `demain ${time}`;
  return `${longDate.format(date)} ${time}`;
}

export const nextSlotQuery = {
  queryKey: ['availability', 'next'],
  queryFn: () => apiRequest<Slot | null>('/availability/next'),
  staleTime: 60_000,
};

/** Badge « Prochain créneau disponible » calculé sur le planning réel. */
export function NextSlotBadge({
  className,
  onBand = false,
}: {
  className?: string;
  onBand?: boolean;
}) {
  const { data } = useQuery(nextSlotQuery);
  if (!data) return null;
  return (
    <p
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-body-sm',
        onBand ? 'bg-slate/60 text-on-band' : 'bg-success-soft text-ink',
        className,
      )}
    >
      <span className="size-2 rounded-full bg-success" aria-hidden />
      Prochain créneau disponible : {relativeSlot(data.start)}
    </p>
  );
}

type SlotPickerProps = { value: string | null; onChange: (start: string) => void };

/** Choix du jour (bandeau défilant) puis de l'heure ; seuls les créneaux libres sont actifs. */
export function SlotPicker({ value, onChange }: SlotPickerProps) {
  const query = useQuery({
    queryKey: ['availability', 'slots'],
    queryFn: () => apiRequest<SlotDay[]>('/availability/slots?days=21'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const days = query.data?.filter((d) => d.slots.length > 0) ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const selectedDay =
    days.find((d) => d.date === picked) ??
    days.find((d) => value && d.slots.some((s) => s.start === value)) ??
    days.find((d) => d.slots.some((s) => s.available));

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Chargement des créneaux">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  if (!days.some((d) => d.slots.some((s) => s.available))) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-dashed border-line p-6 text-body text-ink-muted">
        <CalendarClock className="size-5" aria-hidden />
        Aucun créneau libre dans les trois prochaines semaines. Contactez-nous : nous trouverons une
        solution.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="min-w-0">
        <legend className="mb-2 text-label text-ink">Jour</legend>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {days.map((day) => {
            const free = day.slots.filter((s) => s.available).length;
            const active = day.date === selectedDay?.date;
            const date = new Date(`${day.date}T12:00:00.000Z`);
            return (
              <button
                key={day.date}
                type="button"
                disabled={!free}
                aria-pressed={active}
                onClick={() => setPicked(day.date)}
                className={cn(
                  'flex min-w-18 shrink-0 flex-col items-center rounded-lg border px-3 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  active
                    ? 'border-slate bg-slate text-on-band dark:border-link dark:bg-link dark:text-surface'
                    : 'border-line bg-surface-raised hover:border-field-border',
                )}
              >
                <span className="text-caption capitalize">{dayName.format(date)}</span>
                <span className="text-label">{dayNumber.format(date)}</span>
                <span className="text-caption opacity-80">
                  {free ? `${free} libre${free > 1 ? 's' : ''}` : 'complet'}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      {selectedDay && (
        <fieldset className="min-w-0">
          <legend className="mb-2 text-label text-ink first-letter:uppercase">
            {longDate.format(new Date(`${selectedDay.date}T12:00:00.000Z`))}
          </legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {selectedDay.slots.map((slot) => (
              <button
                key={slot.start}
                type="button"
                disabled={!slot.available}
                aria-pressed={value === slot.start}
                onClick={() => onChange(slot.start)}
                className={cn(
                  'rounded-md border px-3 py-2.5 text-label tabular-nums transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40',
                  value === slot.start
                    ? 'border-slate bg-slate text-on-band dark:border-link dark:bg-link dark:text-surface'
                    : 'border-line bg-surface-raised hover:border-field-border',
                )}
              >
                {hour.format(new Date(slot.start))}
              </button>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
