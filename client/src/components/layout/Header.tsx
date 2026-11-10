import { ChevronDown, Menu, UserRound } from 'lucide-react';
import { CLIENT_PROFILES, PROFILE_META, ROLE_HOME } from '@kodav/shared';
import { NavigationMenu } from 'radix-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router';
import { PoleIcon } from '~/components/site/PoleIcon';
import { Logo } from '~/components/site/Logo';
import { Button } from '~/components/ui';
import { cn } from '~/lib/cn';
import { usePoles } from '~/lib/useSettings';
import { useAuthStore } from '~/stores/auth';
import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative inline-flex h-10 items-center rounded-md px-3 text-label transition-colors hover:text-ink',
    isActive
      ? 'text-ink after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-gold'
      : 'text-ink-muted',
  );

const triggerClass =
  'group inline-flex h-10 items-center gap-1 rounded-md px-3 text-label text-ink-muted transition-colors hover:text-ink data-[state=open]:text-ink';

const panelClass =
  'absolute top-full left-0 mt-3 w-[min(40rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface-raised p-3 shadow-lg data-[motion^=from-]:animate-[fade-in_150ms_ease-out]';

export function Header() {
  const { t } = useTranslation();
  const poles = usePoles();
  const [menuOpen, setMenuOpen] = useState(false);
  // Visiteur anonyme : la page de connexion ; déjà connecté : directement son espace.
  const role = useAuthStore((s) => s.user?.role);
  const accountPath = role ? ROLE_HOME[role] : '/connexion';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-surface">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <NavigationMenu.Root aria-label={t('nav.main')} className="relative hidden lg:block">
          <NavigationMenu.List className="flex items-center gap-1">
            <NavigationMenu.Item>
              <NavigationMenu.Trigger className={triggerClass}>
                {t('nav.services')}
                <ChevronDown
                  className="size-4 transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content className={panelClass}>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {poles.map((pole) => (
                    <li key={pole.slug}>
                      <NavigationMenu.Link asChild>
                        <Link
                          to={`/services/${pole.slug}`}
                          className="flex gap-3 rounded-md p-3 hover:bg-surface-sunken"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-sunken text-slate dark:text-link">
                            <PoleIcon name={pole.icon} className="size-5" />
                          </span>
                          <span>
                            <span className="block text-label text-ink">{pole.name}</span>
                            <span className="line-clamp-2 text-body-sm text-ink-muted">
                              {pole.shortDescription}
                            </span>
                          </span>
                        </Link>
                      </NavigationMenu.Link>
                    </li>
                  ))}
                </ul>
                <NavigationMenu.Link asChild>
                  <Link
                    to="/services"
                    className="mt-2 block rounded-md px-3 py-2 text-label text-link hover:bg-surface-sunken"
                  >
                    {t('nav.allServices')}
                  </Link>
                </NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>

            <NavigationMenu.Item>
              <NavigationMenu.Trigger className={triggerClass}>
                {t('nav.solutions')}
                <ChevronDown
                  className="size-4 transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </NavigationMenu.Trigger>
              <NavigationMenu.Content className={cn(panelClass, 'w-80')}>
                <ul className="grid gap-1">
                  {CLIENT_PROFILES.map((profile) => (
                    <li key={profile}>
                      <NavigationMenu.Link asChild>
                        <Link
                          to={`/solutions/${PROFILE_META[profile].solutionSlug}`}
                          className="block rounded-md px-3 py-2 text-label text-ink hover:bg-surface-sunken"
                        >
                          {PROFILE_META[profile].plural}
                        </Link>
                      </NavigationMenu.Link>
                    </li>
                  ))}
                </ul>
              </NavigationMenu.Content>
            </NavigationMenu.Item>

            {(
              [
                ['/contrats-maintenance', 'nav.contracts'],
                ['/realisations', 'nav.projects'],
                ['/a-propos', 'nav.about'],
                ['/contact', 'nav.contact'],
              ] as const
            ).map(([to, key]) => (
              <NavigationMenu.Item key={to}>
                <NavigationMenu.Link asChild>
                  <NavLink to={to} className={navLinkClass}>
                    {t(key)}
                  </NavLink>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            ))}
          </NavigationMenu.List>
        </NavigationMenu.Root>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to={accountPath}>
              <UserRound aria-hidden />
              {t('nav.account')}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="sm:hidden">
            <Link to={accountPath} aria-label={t('nav.account')}>
              <UserRound className="size-5" aria-hidden />
            </Link>
          </Button>
          {/* L'or est réservé au bouton principal de la page : ici, bouton secondaire. */}
          <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
            <Link to="/devis">{t('cta.quote')}</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={t('nav.openMenu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-6" aria-hidden />
          </Button>
        </div>
      </div>
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} poles={poles} />
    </header>
  );
}
