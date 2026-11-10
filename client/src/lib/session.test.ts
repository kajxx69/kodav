import type { AuthUser } from '@kodav/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_HINT_KEY, useAuthStore } from '~/stores/auth';
import { apiRequest } from './api';
import { requireRole } from './session';

const user: AuthUser = {
  id: 'u1',
  email: 'client@example.ci',
  firstName: 'Awa',
  lastName: 'Koné',
  phone: '+2250707123456',
  role: 'client',
  profile: 'particulier',
  organization: null,
  orgRole: null,
  emailVerified: true,
  notificationPrefs: { email: true },
  createdAt: '2026-11-10T00:00:00.000Z',
};

function json(status: number, body: unknown) {
  return Promise.resolve({ status, json: () => Promise.resolve(body) });
}

const expired = { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Session expirée' } };

async function redirectOf(promise: Promise<unknown>) {
  const res = await promise.then(
    () => null,
    (thrown: unknown) => thrown as Response,
  );
  return res?.headers.get('Location');
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ status: 'unknown', user: null, accessToken: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('rafraîchit une seule fois le jeton expiré puis rejoue les requêtes', async () => {
    useAuthStore.getState().setSession({ accessToken: 'ancien', user });
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return json(200, { success: true, data: { accessToken: 'nouveau', user } });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer nouveau'
        ? json(200, { success: true, data: { ok: true } })
        : json(401, expired);
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.all([apiRequest('/a'), apiRequest('/b')]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
    expect(refreshCalls[0]![1].headers).toMatchObject({ 'X-Requested-With': 'kodav' });
    expect(useAuthStore.getState().accessToken).toBe('nouveau');
  });

  it('ferme la session si le rafraîchissement est refusé', async () => {
    useAuthStore.getState().setSession({ accessToken: 'ancien', user });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json(401, expired)),
    );
    await expect(apiRequest('/a')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', user: null });
    expect(localStorage.getItem(SESSION_HINT_KEY)).toBeNull();
  });
});

describe('requireRole', () => {
  it('renvoie un visiteur anonyme vers la connexion, sans appel réseau', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const location = await redirectOf(
      requireRole(new Request('http://localhost/espace-client/devis?x=1'), ['client']),
    );
    expect(location).toBe('/connexion?redirect=%2Fespace-client%2Fdevis%3Fx%3D1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restaure la session puis renvoie un client hors de l’espace admin', async () => {
    localStorage.setItem(SESSION_HINT_KEY, '1');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json(200, { success: true, data: { accessToken: 'jeton', user } })),
    );
    const location = await redirectOf(
      requireRole(new Request('http://localhost/admin'), ['admin']),
    );
    expect(location).toBe('/espace-client');
    await expect(
      requireRole(new Request('http://localhost/espace-client'), ['client']),
    ).resolves.toMatchObject({ id: 'u1' });
  });
});
