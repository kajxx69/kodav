import type { ApiResponse } from '@kodav/shared';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

/** Appel API minimal (le client complet avec rafraîchissement du token arrive en phase 2). */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...init });
  return (await res.json()) as ApiResponse<T>;
}
