import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';

const profile = (space: string) =>
  route('profil', 'routes/space-profile.tsx', { id: `${space}-profile` });

export default [
  layout('routes/_auth.tsx', [
    route('connexion', 'routes/auth/login.tsx'),
    route('inscription', 'routes/auth/register.tsx'),
    route('mot-de-passe-oublie', 'routes/auth/forgot-password.tsx'),
    route('reinitialiser-mot-de-passe', 'routes/auth/reset-password.tsx'),
    route('verifier-email', 'routes/auth/verify-email.tsx'),
  ]),
  ...prefix('espace-client', [
    layout('routes/espace-client/layout.tsx', [
      index('routes/espace-client/dashboard.tsx'),
      route('devis', 'routes/espace-client/quotes.tsx'),
      route('devis/:id', 'routes/espace-client/quote.tsx'),
      route('rendez-vous', 'routes/espace-client/appointments.tsx'),
      route('rendez-vous/:id', 'routes/espace-client/appointment.tsx'),
      route('tickets', 'routes/espace-client/tickets.tsx'),
      route('tickets/nouveau', 'routes/espace-client/ticket-new.tsx'),
      route('tickets/:id', 'routes/espace-client/ticket.tsx'),
      route('parc', 'routes/espace-client/parc.tsx'),
      route('documents', 'routes/espace-client/documents.tsx'),
      profile('client'),
    ]),
  ]),
  ...prefix('technicien', [
    layout('routes/technicien/layout.tsx', [
      index('routes/technicien/today.tsx'),
      route('interventions/:id', 'routes/technicien/intervention.tsx'),
      route('tickets', 'routes/technicien/tickets.tsx'),
      route('tickets/:id', 'routes/technicien/ticket.tsx'),
      profile('technician'),
    ]),
  ]),
  ...prefix('admin', [
    layout('routes/admin/layout.tsx', [
      index('routes/admin/dashboard.tsx'),
      route('utilisateurs', 'routes/admin/users.tsx'),
      route('devis', 'routes/admin/quotes.tsx'),
      route('devis/:id', 'routes/admin/quote.tsx'),
      route('factures', 'routes/admin/invoices.tsx'),
      route('factures/:id', 'routes/admin/invoice.tsx'),
      route('catalogue', 'routes/admin/catalogue.tsx'),
      route('planning', 'routes/admin/planning.tsx'),
      route('tickets', 'routes/admin/tickets.tsx'),
      route('tickets/:id', 'routes/admin/ticket.tsx'),
      route('clients', 'routes/admin/clients.tsx'),
      route('clients/:kind/:id', 'routes/admin/client.tsx'),
      route('prospects', 'routes/admin/leads.tsx'),
      route('contenu', 'routes/admin/content.tsx'),
      route('parametres', 'routes/admin/settings.tsx'),
      profile('admin'),
    ]),
  ]),
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
    // Parcours livrés dans les phases suivantes (4, 7) : page d'attente avec contact direct.
    route('diagnostic', 'routes/diagnostic.tsx'),
    route('devis', 'routes/devis.tsx'),
    route('devis/reponse', 'routes/devis.reponse.tsx'),
    route('rendez-vous', 'routes/rendez-vous.tsx'),
    route('suivi', 'routes/suivi.tsx'),
    route('bilan-informatique', 'routes/coming-soon.tsx', { id: 'assessment' }),
    route('design-system', 'routes/design-system.tsx'),
    route('*', 'routes/not-found.tsx'),
  ]),
] satisfies RouteConfig;
