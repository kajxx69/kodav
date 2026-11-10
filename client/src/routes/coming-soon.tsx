import { Construction } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { Section } from '~/components/site/Section';
import { Button, EmptyState } from '~/components/ui';
import { normalizePath, pageMeta } from '~/lib/seo';
import type { Route } from './+types/coming-soon';

const pages: Record<string, { title: string; lead: string; subject: string }> = {
  '/rendez-vous': {
    title: 'Prendre rendez-vous',
    lead: 'La réservation de créneaux en ligne arrive très bientôt.',
    subject: 'Demande de rendez-vous',
  },
  '/suivi': {
    title: 'Suivre ma demande',
    lead: 'Le suivi en temps réel de vos interventions arrive très bientôt.',
    subject: 'Suivi de ma demande',
  },
  '/bilan-informatique': {
    title: 'Bilan de santé informatique',
    lead: 'Évaluez en quelques minutes la sécurité et la fiabilité de votre informatique.',
    subject: 'Bilan informatique',
  },
};

export function meta({ matches, location }: Route.MetaArgs) {
  const page = pages[normalizePath(location.pathname)];
  return pageMeta(matches, {
    title: page?.title ?? 'Bientôt disponible',
    description: page?.lead ?? '',
    path: normalizePath(location.pathname),
    noindex: true,
  });
}

/** Parcours en cours de développement : on oriente vers le formulaire de contact. */
export default function ComingSoon() {
  const { pathname, search } = useLocation();
  const page = pages[normalizePath(pathname)] ?? {
    title: 'Bientôt disponible',
    lead: '',
    subject: '',
  };
  const detail =
    new URLSearchParams(search).get('service') ?? new URLSearchParams(search).get('formule');
  const subject = detail
    ? `${page.subject} : ${detail.split('/').pop()?.replace(/-/g, ' ')}`
    : page.subject;
  return (
    <>
      <PageHero title={page.title} lead={page.lead} crumbs={[{ label: page.title }]} />
      <Section>
        <EmptyState
          icon={Construction}
          title="Ce parcours en ligne arrive bientôt"
          description="En attendant, envoyez-nous votre demande : nous vous répondons rapidement."
          action={
            <Button asChild>
              <Link to={`/contact?sujet=${encodeURIComponent(subject)}`}>Envoyer ma demande</Link>
            </Button>
          }
        />
      </Section>
    </>
  );
}
