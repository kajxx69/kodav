import { describe, expect, it } from 'vitest';
import { defaultAvailability } from '../modules/appointments/appointment.model.js';
import { addBusinessHours } from './businessHours.js';

describe('addBusinessHours', () => {
  it('ne compte que les plages ouvertes (pause de midi, week-end, jours fermés)', () => {
    // Vendredi 20 novembre 2026, 16:00 : 2 h le vendredi, 4 h le samedi (9h-13h).
    const friday = new Date('2026-11-20T16:00:00.000Z');
    expect(addBusinessHours(friday, 2, defaultAvailability).toISOString()).toBe(
      '2026-11-20T18:00:00.000Z',
    );
    expect(addBusinessHours(friday, 4, defaultAvailability).toISOString()).toBe(
      '2026-11-21T11:00:00.000Z',
    );
    // 8 h : 2 h vendredi + 4 h samedi + dimanche fermé + 2 h lundi (8h-10h).
    expect(addBusinessHours(friday, 8, defaultAvailability).toISOString()).toBe(
      '2026-11-23T10:00:00.000Z',
    );
    const closed = {
      ...defaultAvailability,
      closedDates: [{ date: '2026-11-23', reason: 'Férié' }],
    };
    expect(addBusinessHours(friday, 8, closed).toISOString()).toBe('2026-11-24T10:00:00.000Z');
  });

  it('démarre à l’ouverture suivante en dehors des heures et saute la pause', () => {
    const night = new Date('2026-11-17T20:00:00.000Z');
    expect(addBusinessHours(night, 5, defaultAvailability).toISOString()).toBe(
      '2026-11-18T14:00:00.000Z',
    );
  });
});
