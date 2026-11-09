import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthStatus } from './HealthStatus';

function mockFetch(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) }));
}

describe('HealthStatus', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("affiche l'état de l'API et de la base", async () => {
    mockFetch({
      success: true,
      data: { status: 'ok', database: 'connected', uptime: 1, version: '0.1.0', timestamp: '' },
    });
    render(<HealthStatus />);
    expect(screen.getByRole('status')).toHaveTextContent("Vérification de l'API");
    expect(await screen.findByText(/opérationnelle/)).toHaveTextContent(
      'base de données : connectée',
    );
  });

  it('signale une API injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<HealthStatus />);
    expect(await screen.findByText('API injoignable.')).toBeInTheDocument();
  });
});
