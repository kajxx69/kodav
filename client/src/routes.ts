import { type RouteConfig, index, layout, route } from '@react-router/dev/routes';

export default [
  layout('routes/_public.tsx', [
    index('routes/home.tsx'),
    route('services', 'routes/services.tsx'),
    route('services/:pole', 'routes/services.pole.tsx'),
    route('services/:pole/:service', 'routes/services.detail.tsx'),
    route('solutions/:profil', 'routes/solutions.tsx'),
    route('contrats-maintenance', 'routes/contrats-maintenance.tsx'),
    route('realisations', 'routes/realisations.tsx'),
    route('realisations/:slug', 'routes/realisations.detail.tsx'),
    route('a-propos', 'routes/a-propos.tsx'),
    route('contact', 'routes/contact.tsx'),
    route('faq', 'routes/faq.tsx'),
    route('mentions-legales', 'routes/legal.tsx', { id: 'legal-notice' }),
    route('confidentialite', 'routes/legal.tsx', { id: 'privacy' }),
    route('cgv', 'routes/legal.tsx', { id: 'terms' }),
    // Parcours livrés dans les phases suivantes (3, 4, 7) : page d'attente avec contact direct.
    route('diagnostic', 'routes/coming-soon.tsx', { id: 'diagnostic' }),
    route('devis', 'routes/coming-soon.tsx', { id: 'quote' }),
    route('rendez-vous', 'routes/coming-soon.tsx', { id: 'appointment' }),
    route('suivi', 'routes/coming-soon.tsx', { id: 'tracking' }),
    route('bilan-informatique', 'routes/coming-soon.tsx', { id: 'assessment' }),
    route('design-system', 'routes/design-system.tsx'),
    route('*', 'routes/not-found.tsx'),
  ]),
] satisfies RouteConfig;
