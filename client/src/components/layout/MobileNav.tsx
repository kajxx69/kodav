import { CLIENT_PROFILES, PROFILE_META } from '@kodav/shared';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router';
import { PoleIcon } from '~/components/site/PoleIcon';
import { Button, Drawer, DrawerClose } from '~/components/ui';
import { cn } from '~/lib/cn';
import type { Pole } from '~/lib/useSettings';

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-md px-3 py-3 text-label hover:bg-surface-sunken',
    isActive ? 'bg-surface-sunken text-ink' : 'text-ink',
  );

/** Menu tiroir sous 1024 px : chaque lien ferme le tiroir. */
export function MobileNav({
  open,
  onOpenChange,
  poles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poles: Pole[];
}) {
  const { t } = useTranslation();
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={t('nav.menu')}>
      <nav aria-label={t('nav.main')} className="flex flex-col gap-6">
        <div>
          <p className="mb-1 px-3 text-overline text-gold-ink">{t('nav.services')}</p>
          <ul>
            {poles.map((pole) => (
              <li key={pole.slug}>
                <DrawerClose asChild>
                  <NavLink to={`/services/${pole.slug}`} className={itemClass}>
                    <PoleIcon name={pole.icon} className="size-5 text-slate dark:text-link" />
                    {pole.name}
                  </NavLink>
                </DrawerClose>
              </li>
            ))}
            <li>
              <DrawerClose asChild>
                <NavLink to="/services" end className={itemClass}>
                  {t('nav.allServices')}
                </NavLink>
              </DrawerClose>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-1 px-3 text-overline text-gold-ink">{t('nav.solutions')}</p>
          <ul>
            {CLIENT_PROFILES.map((profile) => (
              <li key={profile}>
                <DrawerClose asChild>
                  <NavLink
                    to={`/solutions/${PROFILE_META[profile].solutionSlug}`}
                    className={itemClass}
                  >
                    {PROFILE_META[profile].plural}
                  </NavLink>
                </DrawerClose>
              </li>
            ))}
          </ul>
        </div>
        <ul className="border-t border-line pt-4">
          {(
            [
              ['/contrats-maintenance', 'nav.contracts'],
              ['/realisations', 'nav.projects'],
              ['/a-propos', 'nav.about'],
              ['/faq', 'nav.faq'],
              ['/contact', 'nav.contact'],
            ] as const
          ).map(([to, key]) => (
            <li key={to}>
              <DrawerClose asChild>
                <NavLink to={to} className={itemClass}>
                  {t(key)}
                </NavLink>
              </DrawerClose>
            </li>
          ))}
        </ul>
        <DrawerClose asChild>
          <Button asChild size="lg">
            <Link to="/devis">{t('cta.quote')}</Link>
          </Button>
        </DrawerClose>
      </nav>
    </Drawer>
  );
}
