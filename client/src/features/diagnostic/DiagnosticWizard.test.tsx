import type { Service } from '@kodav/shared';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '~/test/render';
import { useProfileStore } from '~/stores/profile';
import { DiagnosticWizard } from './DiagnosticWizard';

const salle = {
  id: 'b'.repeat(24),
  category: { slug: 'reseaux-systemes', name: 'Réseaux' },
  slug: 'salle-informatique',
  name: 'Salle informatique',
  shortDescription: 'Équipement complet',
  longDescription: '',
  targetProfiles: ['ecole'],
  estimatedDuration: { min: 1, max: 2, unit: 'semaine' },
  pricingMode: 'sur_devis',
  isPlaceholderPrice: false,
  options: [],
  modes: ['sur_site'],
  featured: false,
  order: 0,
  seo: { title: '', description: '' },
} satisfies Service;

let body: unknown;
beforeEach(() => {
  useProfileStore.setState({ profile: null });
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return Promise.resolve({
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              recommendations: [{ serviceId: salle.id, reason: 'Prête pour les cours.' }],
              prefill: { profile: 'ecole', urgency: '48h', mode: 'sur_site', commune: 'Yopougon' },
            },
          }),
      });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('DiagnosticWizard', () => {
  it('pose les questions, recommande et pré-remplit le devis', async () => {
    renderWithProviders(<DiagnosticWizard services={[salle]} />);
    fireEvent.click(screen.getByRole('radio', { name: /Écoles/ }));
    expect(useProfileStore.getState().profile).toBe('ecole');
    fireEvent.click(await screen.findByRole('radio', { name: 'Équiper une salle informatique' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Dans les prochains jours/ }));
    fireEvent.click(await screen.findByRole('radio', { name: /Sur place/ }));
    fireEvent.change(await screen.findByLabelText('Commune'), { target: { value: 'Yopougon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Voir les recommandations' }));

    expect(await screen.findByText('Prête pour les cours.')).toBeInTheDocument();
    expect(body).toEqual({
      profile: 'ecole',
      need: 'salle_info',
      urgency: 'rapide',
      mode: 'sur_site',
      commune: 'Yopougon',
    });
    const link = screen.getByRole('link', { name: 'Obtenir mon devis' });
    expect(link.getAttribute('href')).toBe(
      `/devis?services=${salle.id}&urgency=48h&mode=sur_site&source=diagnostic&commune=Yopougon`,
    );
  });
});
