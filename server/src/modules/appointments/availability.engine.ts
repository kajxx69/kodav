import type { AvailabilitySettings, SlotDay } from '@kodav/shared';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Abidjan est en UTC+0 toute l'année : une heure locale « 08:00 » vaut 08:00 UTC. */
const atTime = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00.000Z`);
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

type Busy = { start: Date; end: Date };

/**
 * Créneaux proposés sur une période : plages horaires de chaque jour découpées en créneaux
 * (durée + battement), moins les jours fermés, le délai de prévenance, l'horizon maximum
 * et les créneaux déjà pleins (capacité = min(capacité par créneau, techniciens)).
 */
export function computeSlots(
  settings: AvailabilitySettings,
  busy: Busy[],
  { from, days, now = new Date() }: { from: string; days: number; now?: Date },
): SlotDay[] {
  const closed = new Set(settings.closedDates.map((c) => c.date));
  const earliest = now.getTime() + settings.minNoticeHours * 60 * MINUTE;
  const latest = now.getTime() + settings.maxAdvanceDays * DAY;
  const capacity = Math.min(settings.capacityPerSlot, settings.technicianCount);
  const step = (settings.slotDuration + settings.bufferMinutes) * MINUTE;
  const duration = settings.slotDuration * MINUTE;

  const result: SlotDay[] = [];
  const first = new Date(`${from}T00:00:00.000Z`).getTime();
  for (let i = 0; i < days; i++) {
    const date = isoDate(new Date(first + i * DAY));
    const weekday = new Date(first + i * DAY).getUTCDay();
    const rule = settings.weekly.find((w) => w.day === weekday);
    if (!rule?.open || closed.has(date)) {
      result.push({ date, closed: true, slots: [] });
      continue;
    }
    const slots: SlotDay['slots'] = [];
    for (const range of rule.ranges) {
      const end = atTime(date, range.end).getTime();
      for (let t = atTime(date, range.start).getTime(); t + duration <= end; t += step) {
        if (t < earliest || t > latest) continue;
        const slotEnd = t + duration;
        const taken = busy.filter((b) => b.start.getTime() < slotEnd && b.end.getTime() > t).length;
        slots.push({
          start: new Date(t).toISOString(),
          end: new Date(slotEnd).toISOString(),
          available: taken < capacity,
        });
      }
    }
    result.push({ date, closed: false, slots });
  }
  return result;
}

/** Le créneau demandé fait-il partie des créneaux proposés et libres ? */
export function findSlot(days: SlotDay[], start: string) {
  const wanted = new Date(start).getTime();
  for (const day of days) {
    const slot = day.slots.find((s) => new Date(s.start).getTime() === wanted);
    if (slot) return slot;
  }
  return null;
}
