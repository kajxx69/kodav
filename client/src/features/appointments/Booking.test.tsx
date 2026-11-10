import type { Service, SlotDay } from '@kodav/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '~/test/render';
import { useAuthStore } from '~/stores/auth';
import { BookingForm } from './BookingForm';
import { relativeSlot } from './SlotPicker';

const days: SlotDay[] = [
  {
    date: '2026-11-17',
    closed: false,
    slots: [
      { start: '2026-11-17T08:00:00.000Z', end: '2026-11-17T09:30:00.000Z', available: false },
      { start: '2026-11-17T10:00:00.000Z', end: '2026-11-17T11:30:00.000Z', available: true },
    ],
  },
  { date: '2026-11-18', closed: true, slots: [] },
];

const service = {
  id: 'c'.repeat(24),
  category: { slug: 'maintenance-support', name: 'Maintenance' },
  slug: 'depannage',
  name: 'Dépannage informatique',
  shortDescription: '',
  longDescription: '',
  targetProfiles: ['particulier'],
  estimatedDuration: { min: 1, max: 4, unit: 'heure' },
  pricingMode: 'forfait',
  priceMin: 15000,
  priceMax: 40000,
  isPlaceholderPrice: true,
  options: [],
  modes: ['sur_site', 'atelier'],
  featured: true,
  order: 0,
  seo: { title: '', description: '' },
} satisfies Service;

const json = (status: number, body: unknown) =>
  Promise.resolve({ status, json: () => Promise.resolve(body) });

let bookings: unknown[];
let conflictOnce: boolean;

beforeEach(() => {
  bookings = [];
  conflictOnce = true;
  useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/availability/slots')) return json(200, { success: true, data: days });
      bookings.push(JSON.parse(init!.body as string));
      if (conflictOnce) {
        conflictOnce = false;
        return json(409, {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Ce créneau vient d’être réservé, choisissez-en un autre',
          },
        });
      }
      return json(201, {
        success: true,
        data: {
          id: 'a1',
          reference: 'INT-2026-0001',
          start: '2026-11-17T10:00:00.000Z',
          hasAccount: false,
          contact: { email: 'awa@example.ci' },
        },
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('relativeSlot', () => {
  it('formule le prochain créneau comme une personne le dirait', () => {
    const now = new Date('2026-11-16T15:00:00.000Z');
    expect(relativeSlot('2026-11-16T16:30:00.000Z', now)).toBe('aujourd’hui 16h30');
    expect(relativeSlot('2026-11-17T09:00:00.000Z', now)).toBe('demain 9h');
    expect(relativeSlot('2026-11-19T08:00:00.000Z', now)).toBe('jeudi 19 novembre 8h');
  });
});

describe('BookingForm', () => {
  it('réserve un créneau libre et revient au choix si le créneau vient d’être pris', async () => {
    renderWithProviders(<BookingForm services={[service]} initialServiceId={service.id} />);

    expect(screen.queryByRole('radio', { name: /À distance/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText('Décrivez brièvement votre besoin')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Décrivez votre besoin/), {
      target: { value: 'Ordinateur qui ne démarre plus' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    const full = await screen.findByRole('button', { name: '08:00' });
    expect(full).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '10:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    fireEvent.change(await screen.findByLabelText(/Nom et prénom/), {
      target: { value: 'Awa Koné' },
    });
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '0707123456' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'awa@example.ci' } });
    fireEvent.change(screen.getByLabelText(/Commune/), { target: { value: 'Cocody' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rendez-vous' }));

    // 409 : retour à l'étape du créneau avec le message.
    expect(await screen.findByText(/vient d’être réservé/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2. Créneau' })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: '10:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmer le rendez-vous' }));
    expect(await screen.findByText('Rendez-vous enregistré')).toBeInTheDocument();

    await waitFor(() => expect(bookings).toHaveLength(2));
    expect(bookings[1]).toMatchObject({
      start: '2026-11-17T10:00:00.000Z',
      mode: 'sur_site',
      serviceId: service.id,
      contact: { phone: '+2250707123456' },
      address: { commune: 'Cocody' },
    });
  });
});
