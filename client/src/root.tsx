import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from 'react-router';
import { Toaster } from '~/components/ui';
import { NotFoundContent } from '~/components/site/NotFoundContent';
import { fetchAtBuild, fetchInBrowser } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { createQueryClient, queryClient } from '~/lib/queryClient';
import { ensureSession } from '~/lib/session';
import type { RootData } from '~/lib/useSettings';
import { useProfileStore } from '~/stores/profile';
import { themeInitScript, useThemeStore } from '~/stores/theme';
import displayFont from '~/brand/fonts/PlusJakartaSans-ExtraBold.woff2?url';
import bodyFont from '~/brand/fonts/Inter-Regular.woff2?url';
import '~/lib/i18n';
import './app.css';
import type { Route } from './+types/root';

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'icon', href: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  // Polices du texte courant et des grands titres préchargées (premier affichage).
  { rel: 'preload', href: bodyFont, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  { rel: 'preload', href: displayFont, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
];

/** Au build : identité de l'entreprise et pôles figés dans chaque page pré-rendue. */
async function loadRoot(fetch: typeof fetchAtBuild): Promise<RootData> {
  const [settings, categories] = await Promise.all([
    fetch(queries.settings()),
    fetch(queries.categories()),
  ]);
  return {
    settings,
    poles:
      categories?.map(({ slug, name, shortDescription, icon }) => ({
        slug,
        name,
        shortDescription,
        icon,
      })) ?? null,
  };
}

export const loader = () => loadRoot(fetchAtBuild);
export const clientLoader = () => loadRoot(fetchInBrowser);

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0b1b33" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <noscript>
          <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
        </noscript>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Providers({ children }: { children: ReactNode }) {
  // Au pré-rendu, un cache neuf par page : sinon une page hériterait des données d'une autre
  // et son HTML différerait de ce que le navigateur affiche à l'hydratation.
  const [client] = useState(() =>
    typeof window === 'undefined' ? createQueryClient() : queryClient,
  );
  useEffect(() => {
    useThemeStore.getState().hydrate();
    useProfileStore.getState().hydrate();
    // Session restaurée en arrière-plan (lien « Mon espace » du header).
    void ensureSession();
  }, []);
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster />
      </MotionConfig>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <Providers>
      <Outlet />
    </Providers>
  );
}

export function HydrateFallback() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Chargement">
      <span className="size-8 animate-spin rounded-full border-2 border-line border-t-gold" />
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (!notFound && import.meta.env.DEV) console.error(error);
  return (
    <Providers>
      <main className="container-page grid min-h-dvh place-items-center py-16">
        <NotFoundContent
          code={notFound ? '404' : 'Erreur'}
          title={notFound ? 'Page introuvable' : 'Une erreur est survenue'}
          description={
            notFound
              ? "Cette page n'existe pas ou a été déplacée."
              : 'Rechargez la page ou revenez à l’accueil. Si le problème persiste, contactez-nous.'
          }
        />
      </main>
    </Providers>
  );
}
