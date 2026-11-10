import { Hourglass } from 'lucide-react';
import { useLocation } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import { EmptyState } from '~/components/ui';
import { normalizePath } from '~/lib/seo';

/** Rubriques des espaces livrées dans les phases suivantes : titre et contenu prévu. */
const sections: Record<string, { title: string; lead: string }> = {
  '/espace-client/documents': {
    title: 'Mes documents',
    lead: 'Devis, rapports d’intervention et factures au format PDF.',
  },
  '/admin/clients': {
    title: 'Clients et organisations',
    lead: 'Fiche complète : coordonnées, devis, rendez-vous, tickets, parc et factures.',
  },
  '/admin/prospects': {
    title: 'Prospects',
    lead: 'Demandes issues du formulaire de contact, du diagnostic et du bilan informatique.',
  },
  '/admin/contenu': {
    title: 'Contenu',
    lead: 'Réalisations, témoignages à valider, FAQ et textes des pages.',
  },
  '/admin/parametres': {
    title: 'Paramètres',
    lead: 'Identité de l’entreprise, horaires, zones, règles tarifaires, formules et emails.',
  },
};

export default function SpacePlaceholder() {
  const section = sections[normalizePath(useLocation().pathname)] ?? {
    title: 'Rubrique',
    lead: '',
  };
  return (
    <>
      <SpaceHeader title={section.title} lead={section.lead} />
      <EmptyState
        icon={Hourglass}
        title="Cette rubrique sera bientôt disponible"
        description="Elle est en cours de construction. Pour toute demande urgente, contactez-nous directement."
      />
    </>
  );
}
