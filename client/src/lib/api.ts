import type { ApiResponse, AuthSession } from '@kodav/shared';
import { SESSION_HINT_KEY, useAuthStore } from '~/stores/auth';
import { safeStorage } from './storage';

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
  // Session en cours de restauration (rechargement de page) : on attend son jeton plutôt
  // que de partir sans et d'essuyer un 401.
  const state = useAuthStore.getState();
  if (!state.accessToken && state.status === 'unknown' && safeStorage.get(SESSION_HINT_KEY)) {
    await refreshSession().catch(() => null);
  }
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

/** Fichier protégé (PDF) : jeton joint, rafraîchi au besoin, puis ouverture dans un onglet. */
export async function openProtectedFile(path: string) {
  // Onglet ouvert tout de suite : sinon le navigateur le bloque après l'attente réseau.
  const tab = window.open('', '_blank');
  const load = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  try {
    let res = await load(useAuthStore.getState().accessToken);
    if (res.status === 401) {
      const session = await refreshSession();
      if (session) res = await load(session.accessToken);
    }
    if (!res.ok) throw new ApiRequestError(res.status, 'FILE_ERROR', 'Document indisponible');
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

/** Image protégée (photo de rapport) en URL locale, à libérer avec URL.revokeObjectURL. */
export async function fetchProtectedBlobUrl(path: string) {
  const load = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  let res = await load(useAuthStore.getState().accessToken);
  if (res.status === 401) {
    const session = await refreshSession();
    if (session) res = await load(session.accessToken);
  }
  if (!res.ok) throw new ApiRequestError(res.status, 'FILE_ERROR', 'Image indisponible');
  return URL.createObjectURL(await res.blob());
}

/** Téléchargement protégé (export CSV) : jeton joint, fichier enregistré par le navigateur. */
export async function downloadProtectedFile(path: string) {
  const load = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  let res = await load(useAuthStore.getState().accessToken);
  if (res.status === 401) {
    const session = await refreshSession();
    if (session) res = await load(session.accessToken);
  }
  if (!res.ok) throw new ApiRequestError(res.status, 'FILE_ERROR', 'Téléchargement impossible');
  const name =
    /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ??
    `kodav-${path.split('/').pop() ?? 'export.csv'}`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
