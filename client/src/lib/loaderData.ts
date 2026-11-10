import { useQuery } from '@tanstack/react-query';
import { data } from 'react-router';
import { ApiRequestError } from './api';
import type { ApiQuery } from './queries';
import { queryClient } from './queryClient';

/**
 * Données de page en deux temps :
 * - au build, le `loader` interroge l'API et le résultat est figé dans le HTML pré-rendu (SEO) ;
 * - dans le navigateur, la requête repart aussitôt (données marquées périmées) pour refléter
 *   les dernières modifications faites dans l'admin, sans attendre un nouveau build.
 */
export function useLiveQuery<T>(query: ApiQuery<T>, buildData: T | null | undefined) {
  return useQuery({
    queryKey: query.queryKey,
    queryFn: query.queryFn,
    ...(buildData == null ? {} : { initialData: buildData, initialDataUpdatedAt: 0 }),
  });
}

function isNotFound(err: unknown) {
  return err instanceof ApiRequestError && err.status === 404;
}

/** Réponses partagées entre les pages pré-rendues (paramètres et catalogue sur chaque page). */
const buildCache = new Map<string, Promise<unknown>>();
/** React Router abandonne une page après 10 s : on rend la main avant. */
const BUILD_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`délai de ${BUILD_TIMEOUT_MS} ms dépassé`)),
        BUILD_TIMEOUT_MS,
      ),
    ),
  ]);
}

/** Loader de build : si l'API est injoignable ou lente, la page sera complétée côté navigateur. */
export async function fetchAtBuild<T>(query: ApiQuery<T>): Promise<T | null> {
  const key = JSON.stringify(query.queryKey);
  if (!buildCache.has(key)) buildCache.set(key, query.queryFn());
  try {
    return (await withTimeout(buildCache.get(key)!)) as T;
  } catch (err) {
    // Une erreur réseau ne doit pas rester en cache pour les pages suivantes.
    if (!isNotFound(err)) buildCache.delete(key);
    if (isNotFound(err)) throw data(null, { status: 404 });
    console.warn(`[prérendu] API injoignable, contenu chargé dans le navigateur : ${String(err)}`);
    return null;
  }
}

/** clientLoader : interroge l'API en direct (avec cache) ; 404 → page introuvable. */
export async function fetchInBrowser<T>(query: ApiQuery<T>): Promise<T | null> {
  try {
    return await queryClient.ensureQueryData({ queryKey: query.queryKey, queryFn: query.queryFn });
  } catch (err) {
    if (isNotFound(err)) throw data(null, { status: 404 });
    // Réseau absent : la page s'affiche et gère son propre état d'erreur.
    return null;
  }
}
