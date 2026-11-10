import { ArrowLeft } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { ThemeToggle } from '~/components/layout/ThemeToggle';
import { Logo } from '~/components/site/Logo';
import { NetworkPattern } from '~/components/site/NetworkPattern';
import { redirectIfAuthenticated } from '~/lib/session';
import type { Route } from './+types/_auth';

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  // La page de confirmation d'email reste accessible une fois connecté.
  if (new URL(request.url).pathname.startsWith('/verifier-email')) return null;
  return redirectIfAuthenticated(request);
}

/** Pages de connexion, inscription et mot de passe : centrées, sans navigation du site. */
export default function AuthLayout() {
  return (
    <div className="relative flex min-h-dvh flex-col bg-surface-sunken">
      <NetworkPattern className="pointer-events-none absolute inset-x-0 top-0 h-64 text-line opacity-60" />
      <header className="relative container-page flex h-16 items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            to="/"
            className="hidden items-center gap-1 rounded-md px-3 py-2 text-label text-ink-muted hover:text-ink sm:inline-flex"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Retour au site
          </Link>
        </div>
      </header>
      <main
        id="contenu"
        className="relative flex flex-1 items-start justify-center px-4 py-8 sm:py-14"
      >
        <Outlet />
      </main>
    </div>
  );
}
