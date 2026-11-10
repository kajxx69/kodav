import type { LucideIcon } from 'lucide-react';
import { Menu } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { ThemeToggle } from '~/components/layout/ThemeToggle';
import { Logo } from '~/components/site/Logo';
import { Button, Drawer, DrawerClose } from '~/components/ui';
import { cn } from '~/lib/cn';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import { UserMenu } from './UserMenu';

export type SpaceNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Correspondance exacte (page d'accueil de l'espace). */
  end?: boolean;
};

type AppShellProps = {
  /** Nom de l'espace, ex. « Espace client ». */
  title: string;
  nav: SpaceNavItem[];
  profilePath: string;
  /** Barre d'onglets en bas d'écran sur mobile (espace technicien, usage à une main). */
  bottomNav?: boolean;
};

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-label transition-colors [&_svg]:size-5 [&_svg]:shrink-0',
    isActive
      ? 'bg-surface-sunken text-ink before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-gold'
      : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  );

function NavList({ nav, inDrawer = false }: { nav: SpaceNavItem[]; inDrawer?: boolean }) {
  return (
    <ul className="flex flex-col gap-1">
      {nav.map(({ to, label, icon: Icon, end }) => {
        const link = (
          <NavLink to={to} end={end} className={linkClass}>
            <Icon aria-hidden />
            {label}
          </NavLink>
        );
        return <li key={to}>{inDrawer ? <DrawerClose asChild>{link}</DrawerClose> : link}</li>;
      })}
    </ul>
  );
}

/** Gabarit commun aux espaces client, technicien et admin. */
export function AppShell({ title, nav, profilePath, bottomNav = false }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-dvh bg-surface-sunken/40">
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-surface-raised px-4 py-2 text-label focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface-raised lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <p className="px-5 pt-2 pb-3 text-overline text-gold-ink">{title}</p>
        <nav aria-label={title} className="flex-1 overflow-y-auto px-3 pb-6">
          <NavList nav={nav} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            {!bottomNav && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ouvrir le menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <Menu className="size-6" aria-hidden />
              </Button>
            )}
            <Logo />
          </div>
          <p className="hidden text-label text-ink-muted lg:block">{title}</p>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <UserMenu profilePath={profilePath} />
          </div>
        </header>

        <main
          id="contenu"
          tabIndex={-1}
          className={cn(
            'mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 outline-none sm:px-6 lg:py-8',
            bottomNav && 'pb-24 lg:pb-8',
          )}
        >
          <EmailVerificationBanner />
          <Outlet />
        </main>
      </div>

      {!bottomNav && (
        <Drawer open={menuOpen} onOpenChange={setMenuOpen} title={title}>
          <nav aria-label={title}>
            <NavList nav={nav} inDrawer />
          </nav>
        </Drawer>
      )}

      {bottomNav && (
        <nav
          aria-label={title}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
            {nav.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-16 flex-col items-center justify-center gap-1 text-caption',
                      isActive ? 'text-ink' : 'text-ink-muted',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('size-6', isActive && 'text-gold-ink')} aria-hidden />
                      {label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

/** En-tête d'une page d'espace : titre, sous-titre, actions. */
export function SpaceHeader({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-h2">{title}</h1>
        {lead && <p className="mt-1 text-body text-ink-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
