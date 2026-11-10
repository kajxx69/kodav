import type { CategoryWithServices, Estimate, Service } from '@kodav/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '~/test/render';
import { useAuthStore } from '~/stores/auth';
import { useProfileStore } from '~/stores/profile';
import { Configurator } from './Configurator';
import { useDraftStore } from './draftStore';

const service = (id: string, patch: Partial<Service>): Service => ({
  id,
  category: { slug: 'reseaux-systemes', name: 'Réseaux' },
  slug: id,
  name: id,
  shortDescription: '',
  longDescription: '',
  targetProfiles: ['pme'],
  estimatedDuration: { min: 1, max: 2, unit: 'jour' },
  pricingMode: 'forfait',
  priceMin: 10000,
  priceMax: 20000,
  isPlaceholderPrice: false,
  options: [],
  modes: ['sur_site'],
  featured: false,
  order: 0,
  seo: { title: '', description: '' },
  ...patch,
});

const catalog: CategoryWithServices[] = [
  {
    id: 'c1',
    slug: 'reseaux-systemes',
    name: 'Réseaux',
    shortDescription: '',
    description: '',
    icon: 'network',
    order: 0,
    seo: { title: '', description: '' },
    services: [
      service('a'.repeat(24), {
        name: 'Câblage',
        pricingMode: 'par_unite',
        unitLabel: 'poste',
        options: [
          {
            key: 'baie',
            label: 'Baie de brassage',
            type: 'boolean',
            impact: { kind: 'fixed', min: 1, max: 2 },
          },
        ],
      }),
    ],
  },
];

const estimate: Estimate = {
  lines: [],
  subtotal: { min: 0, max: 0 },
  volumeDiscount: { min: 0, max: 0 },
  urgency: { key: 'standard', label: 'Standard', percent: 0, amount: { min: 0, max: 0 } },
  travel: { status: 'included', fee: 5000, commune: 'Cocody' },
  total: { min: 125000, max: 230000 },
  hasOnQuoteItems: false,
  isPlaceholderPrice: false,
  duration: null,
};

const ok = (data: unknown) =>
  Promise.resolve({ status: 200, json: () => Promise.resolve({ success: true, data }) });

let posted: { path: string; body: unknown }[];

beforeEach(() => {
  localStorage.clear();
  useDraftStore.getState().reset();
  useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
  useProfileStore.setState({ profile: 'pme' });
  posted = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const path = url.replace(/^.*\/api\/v1/, '');
      if (init?.body) posted.push({ path, body: JSON.parse(init.body as string) });
      if (path === '/pricing/rules') {
        return ok({
          urgency: [{ key: 'standard', label: 'Standard', percent: 0 }],
          communes: [],
          volumeDiscount: [],
        });
      }
      if (path === '/pricing/estimate') return ok(estimate);
      if (path === '/quotes') {
        return ok({
          id: 'q1',
          reference: 'DEV-2026-0001',
          hasAccount: false,
          contact: { email: 'awa@example.ci' },
        });
      }
      return ok(null);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('Configurator', () => {
  it('estime en direct, sauvegarde le brouillon et envoie une demande complète', async () => {
    renderWithProviders(<Configurator catalog={catalog} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Câblage/ }));
    const aside = screen.getByRole('complementary', { name: 'Estimation' });
    await waitFor(() => expect(aside.textContent).toMatch(/125\s000\s–\s230\s000\sFCFA/));
    expect(JSON.parse(localStorage.getItem('kodav:quote-draft')!).items).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.change(screen.getByLabelText('Nombre de postes'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Baie de brassage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    // Sur site : la commune est obligatoire avant de continuer.
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Commune/), { target: { value: 'Cocody' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    fireEvent.change(screen.getByLabelText(/Nom et prénom/), { target: { value: 'Awa Koné' } });
    fireEvent.change(screen.getByLabelText(/Téléphone/), { target: { value: '0707123456' } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'awa@example.ci' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /J’accepte/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer ma demande' }));

    expect(await screen.findByText('Demande envoyée')).toBeInTheDocument();
    const submission = posted.find((p) => p.path === '/quotes')!.body;
    expect(submission).toMatchObject({
      items: [{ serviceId: 'a'.repeat(24), quantity: 12, options: { baie: true } }],
      mode: 'sur_site',
      commune: 'Cocody',
      contact: { phone: '+2250707123456', profile: 'pme' },
      consent: true,
    });
  });

  it('reprend le brouillon sauvegardé dans le navigateur', async () => {
    localStorage.setItem(
      'kodav:quote-draft',
      JSON.stringify({ step: 1, items: [{ serviceId: 'a'.repeat(24), quantity: 5 }] }),
    );
    renderWithProviders(<Configurator catalog={catalog} />);
    expect(await screen.findByLabelText('Nombre de postes')).toHaveValue(5);
    await waitFor(() => expect(posted.some((p) => p.path === '/pricing/estimate')).toBe(true));
  });
});
