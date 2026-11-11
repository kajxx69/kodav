import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router';
import { CommandPalette } from '~/components/layout/CommandPalette';
import { ContactFab } from '~/components/layout/ContactFab';
import { Footer } from '~/components/layout/Footer';
import { Header } from '~/components/layout/Header';
import { useHydrated } from '~/lib/useHydrated';

/** Gabarit des pages publiques : header, contenu avec transition, pied de page, contact flottant. */
export default function PublicLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const hydrated = useHydrated();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-surface-raised px-4 py-2 text-label focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('skipToContent')}
      </a>
      <Header />
      <motion.main
        id="contenu"
        key={pathname}
        tabIndex={-1}
        className="flex-1 outline-none"
        // Pas d'animation sur la page pré-rendue : seulement lors des navigations.
        initial={hydrated ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <Outlet />
      </motion.main>
      <Footer />
      <ContactFab />
      <CommandPalette />
    </div>
  );
}
