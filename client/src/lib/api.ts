import type { ApiResponse } from '@kodav/shared';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

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

/** Appel API brut au format { success, data } (le rafraîchissement du token arrive en phase 2). */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init });
  return (await res.json()) as ApiResponse<T>;
}

/** Renvoie directement `data`, ou lève une ApiRequestError. */
export async function apiRequest<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      ...rest,
      headers: {
        ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
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
