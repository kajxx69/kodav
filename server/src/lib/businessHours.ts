import type { AvailabilitySettings } from '@kodav/shared';

const MINUTE = 60_000;
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Ajoute des heures ouvrées à une date, d'après les plages horaires d'intervention
 * (Abidjan, UTC+0) et les jours fermés. Sans plage ouverte, repli sur des heures pleines.
 */
export function addBusinessHours(start: Date, hours: number, settings: AvailabilitySettings) {
  const closed = new Set(settings.closedDates.map((c) => c.date));
  if (!settings.weekly.some((d) => d.open && d.ranges.length)) {
    return new Date(start.getTime() + hours * 60 * MINUTE);
  }
  let remaining = hours * 60;
  let cursor = start.getTime();
  // Garde-fou : au plus un an de calendrier parcouru.
  for (let guard = 0; guard < 366 && remaining > 0; guard++) {
    const day = new Date(cursor);
    const date = day.toISOString().slice(0, 10);
    const midnight = new Date(`${date}T00:00:00.000Z`).getTime();
    const rule = settings.weekly.find((w) => w.day === day.getUTCDay());
    if (rule?.open && !closed.has(date)) {
      for (const range of [...rule.ranges].sort((a, b) => a.start.localeCompare(b.start))) {
        const from = Math.max(cursor, midnight + minutes(range.start) * MINUTE);
        const to = midnight + minutes(range.end) * MINUTE;
        if (from >= to) continue;
        const available = (to - from) / MINUTE;
        if (available >= remaining) return new Date(from + remaining * MINUTE);
        remaining -= available;
        cursor = to;
      }
    }
    cursor = midnight + 24 * 60 * MINUTE;
  }
  return new Date(cursor);
}
