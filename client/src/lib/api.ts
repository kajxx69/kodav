import type { ApiResponse, AuthSession } from '@kodav/shared';
import { useAuthStore } from '~/stores/auth';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

/** En-tête exigé par l'API sur les routes qui lisent le cookie de session (anti-CSRF). */
const APP_HEADER = { 'X-Requested-With': 'kodav' };

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Appel API brut au format { success, data }. */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init });
  return (await res.json()) as ApiResponse<T>;
}

type RequestOptions = RequestInit & { json?: unknown };

async function send<T>(path: string, init: RequestOptions, token: string | null): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      ...rest,
      headers: {
        ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: json === undefined ? rest.body : JSON.stringify(json),
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Connexion impossible. Vérifiez votre réseau.');
  }
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!body)
    throw new ApiRequestError(res.status, 'INVALID_RESPONSE', 'Réponse inattendue du serveur');
  if (!body.success) {
    const { code, message, details } = body.error;
    throw new ApiRequestError(res.status, code, message, details as ApiRequestError['details']);
  }
  return body.data;
}

let refreshing: Promise<AuthSession | null> | null = null;

/**
 * Échange le cookie de session contre un nouveau jeton d'accès. Un seul appel à la fois :
 * plusieurs requêtes expirées simultanément attendent le même rafraîchissement.
 */
export function refreshSession(): Promise<AuthSession | null> {
  refreshing ??= send<AuthSession>('/auth/refresh', { method: 'POST', headers: APP_HEADER }, null)
    .then((session) => {
      useAuthStore.getState().setSession(session);
      return session;
    })
    .catch((err: unknown) => {
      // Réseau coupé : la session est peut-être encore valide, on ne déconnecte pas.
      if (err instanceof ApiRequestError && err.status === 0) throw err;
      useAuthStore.getState().clear();
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Renvoie directement `data`, ou lève une ApiRequestError ; jeton rafraîchi si expiré. */
export async function apiRequest<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  try {
    return await send<T>(path, init, token);
  } catch (err) {
    if (!(token && err instanceof ApiRequestError && err.status === 401)) throw err;
    const session = await refreshSession();
    if (!session) throw err;
    return send<T>(path, init, session.accessToken);
  }
}

export async function logoutRequest() {
  try {
    await send('/auth/logout', { method: 'POST', headers: APP_HEADER }, null);
  } finally {
    useAuthStore.getState().clear();
  }
}
