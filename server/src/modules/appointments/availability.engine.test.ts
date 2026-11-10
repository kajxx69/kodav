import { describe, expect, it } from 'vitest';
import { defaultAvailability } from './appointment.model.js';
import { computeSlots, findSlot } from './availability.engine.js';

// Lundi 16 novembre 2026, 07:00 à Abidjan (UTC+0).
const now = new Date('2026-11-16T07:00:00.000Z');

describe('computeSlots', () => {
  it('découpe les plages en créneaux et respecte le délai de prévenance', () => {
    const [monday, , , , , saturday, sunday] = computeSlots(defaultAvailability, [], {
      from: '2026-11-16',
      days: 7,
      now,
    });
    // 90 min + 30 min de battement ; avant 11:00 (now + 4 h) : rien.
    expect(monday!.slots.map((s) => s.start.slice(11, 16))).toEqual(['13:00', '15:00']);
    expect(saturday!.slots.map((s) => s.start.slice(11, 16))).toEqual(['09:00', '11:00']);
    expect(sunday).toMatchObject({ closed: true, slots: [] });
  });

  it('marque complet un créneau occupé et ferme les jours fériés', () => {
    const busy = [
      { start: new Date('2026-11-17T08:00:00.000Z'), end: new Date('2026-11-17T09:30:00.000Z') },
    ];
    const settings = {
      ...defaultAvailability,
      closedDates: [{ date: '2026-11-18', reason: 'Férié' }],
    };
    const days = computeSlots(settings, busy, { from: '2026-11-17', days: 2, now });
    expect(findSlot(days, '2026-11-17T08:00:00.000Z')?.available).toBe(false);
    expect(findSlot(days, '2026-11-17T10:00:00.000Z')?.available).toBe(true);
    expect(days[1]).toMatchObject({ closed: true });

    // Deux techniciens et deux places par créneau : le créneau reste ouvert.
    const two = computeSlots({ ...settings, capacityPerSlot: 2, technicianCount: 2 }, busy, {
      from: '2026-11-17',
      days: 1,
      now,
    });
    expect(findSlot(two, '2026-11-17T08:00:00.000Z')?.available).toBe(true);
  });

  it('ne propose rien au-delà de l’horizon de réservation', () => {
    const days = computeSlots({ ...defaultAvailability, maxAdvanceDays: 2 }, [], {
      from: '2026-11-20',
      days: 1,
      now,
    });
    expect(days[0]!.slots).toEqual([]);
  });
});
