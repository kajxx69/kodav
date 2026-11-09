import type { Config } from '@react-router/dev/config';

/**
 * SPA sans serveur Node côté front : les pages publiques sont pré-rendues en HTML
 * statique au build (SEO), les espaces connectés restent rendus côté navigateur.
 * La liste des routes à pré-rendre s'enrichit à chaque phase (services chargés depuis l'API).
 */
export default {
  appDirectory: 'src',
  ssr: false,
  prerender: ['/'],
} satisfies Config;
