import { ROLE_HOME, type UserRole } from '@kodav/shared';
import { redirect } from 'react-router';
import { useAuthStore, SESSION_HINT_KEY } from '~/stores/auth';
import { refreshSession } from './api';
import { queryClient } from './queryClient';
import { safeStorage } from './storage';

let restoring: Promise<void> | null = null;

/**
 * Au premier besoin (garde d'une route, header), restaure la session depuis le cookie
 * httpOnly. Sans indice de session, aucun appel réseau : le visiteur est anonyme.
 */
export function ensureSession(): Promise<void> {
  if (useAuthStore.getState().status !== 'unknown') return Promise.resolve();
  if (!safeStorage.get(SESSION_HINT_KEY)) {
    useAuthStore.getState().clear();
    return Promise.resolve();
  }
  restoring ??= refreshSession()
    .then(() => undefined)
    .catch(() => {
      // Hors ligne : traité comme anonyme pour cette visite, l'indice est conservé.
      useAuthStore.setState({ status: 'anonymous' });
    })
    .finally(() => {
      restoring = null;
    });
  return restoring;
}

/** Chemin de retour sûr après connexion : uniquement un chemin interne. */
export function safeRedirectPath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

/**
 * Garde des espaces connectés (clientLoader) : visiteur anonyme → connexion avec retour
 * prévu ; rôle non autorisé → accueil de son propre espace.
 */
export async function requireRole(request: Request, roles: UserRole[]) {
  await ensureSession();
  const { user } = useAuthStore.getState();
  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/connexion?redirect=${encodeURIComponent(url.pathname + url.search)}`);
  }
  if (!roles.includes(user.role)) throw redirect(ROLE_HOME[user.role]);
  return user;
}

/** Pages d'authentification : un utilisateur déjà connecté rejoint son espace. */
export async function redirectIfAuthenticated(request: Request) {
  await ensureSession();
  const { user } = useAuthStore.getState();
  if (user) {
    const next = safeRedirectPath(new URL(request.url).searchParams.get('redirect'));
    throw redirect(next ?? ROLE_HOME[user.role]);
  }
  return null;
}

/** Après déconnexion : plus aucune donnée privée en cache. */
export function clearPrivateCache() {
  queryClient.removeQueries({ queryKey: ['me'] });
  queryClient.removeQueries({ queryKey: ['private'] });
}
