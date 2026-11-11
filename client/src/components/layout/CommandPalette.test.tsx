import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '~/test/render';
import { CommandPalette, matches, useCommandPalette } from './CommandPalette';

const categories = [
  {
    id: 'c1',
    slug: 'reseaux-systemes',
    name: 'Réseaux et systèmes',
    services: [
      {
        id: 's1',
        slug: 'wifi-professionnel',
        name: 'Wi-Fi professionnel',
        shortDescription: 'Couverture des bureaux',
        category: { slug: 'reseaux-systemes', name: 'Réseaux et systèmes' },
      },
    ],
  },
];

function Where() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

describe('CommandPalette', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useCommandPalette.setState({ open: false });
  });

  it('ignore les accents, la ponctuation et les traits d’union', () => {
    expect(matches({ label: 'Réseau Wi-Fi' }, 'reseau wifi')).toBe(true);
    expect(matches({ label: 'Réseau Wi-Fi' }, 'reseau wi fi')).toBe(true);
    expect(matches({ label: 'Sauvegarde', keywords: 'données' }, 'donnees')).toBe(true);
  });

  it('s’ouvre avec Ctrl+K, cherche dans les services et ouvre le résultat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve({
          status: 200,
          json: () =>
            Promise.resolve({ success: true, data: url.includes('faqs') ? [] : categories }),
        }),
      ),
    );
    renderWithProviders(
      <>
        <CommandPalette />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </>,
    );

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('combobox');
    expect(screen.getByRole('option', { name: 'Demander un devis' })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'wi-fi pro' } });
    const option = await screen.findByRole('option', { name: /Wi-Fi professionnel/ });
    expect(option).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByTestId('path')).toHaveTextContent(
      '/services/reseaux-systemes/wifi-professionnel',
    );
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
