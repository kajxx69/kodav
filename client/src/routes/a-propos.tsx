import { FileCheck2, KeyRound, MessagesSquare, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { Reveal } from '~/components/site/Reveal';
import { Section, SectionHeader } from '~/components/site/Section';
import { Button, Card } from '~/components/ui';
import { MethodSection } from '~/features/home/MethodSection';
import { pageMeta } from '~/lib/seo';
import { useBrand } from '~/lib/useSettings';
import type { Route } from './+types/a-propos';

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'À propos',
    description:
      'Une entreprise de services informatiques fondée à Abidjan par un administrateur réseaux et systèmes, également développeur.',
    path: '/a-propos',
  });
}

const values = [
  {
    icon: MessagesSquare,
    title: 'Des explications claires',
    description:
      'Nous expliquons le problème et la solution avec des mots simples, avant d’intervenir.',
  },
  {
    icon: KeyRound,
    title: 'Des licences authentiques',
    description: 'Aucun logiciel piraté : vos postes restent à jour, sécurisés et en règle.',
  },
  {
    icon: FileCheck2,
    title: 'Tout est écrit',
    description: 'Devis détaillés, rapports d’intervention et documentation de votre réseau.',
  },
  {
    icon: ShieldCheck,
    title: 'Vos données protégées',
    description: 'Accès limité au strict nécessaire, conformément à la loi ivoirienne n° 2013-450.',
  },
];

export default function About() {
  const brand = useBrand();
  return (
    <>
      <PageHero
        overline="À propos"
        title="Une double compétence, réseau et développement"
        lead={`${brand?.legalName ?? 'Notre entreprise'} a été fondée à Abidjan par un administrateur réseaux et systèmes, également développeur. Cette double compétence nous permet de traiter un problème de bout en bout, du câble au logiciel.`}
        crumbs={[{ label: 'À propos' }]}
      />
      <Section>
        <SectionHeader overline="Nos engagements" title="Ce qui guide chaque intervention" />
        <ul className="grid gap-6 sm:grid-cols-2">
          {values.map(({ icon: Icon, title, description }, i) => (
            <Reveal as="li" key={title} delay={i * 0.05} className="h-full">
              <Card className="flex h-full gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-md bg-gold-soft text-gold-ink">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-h4">{title}</h3>
                  <p className="mt-1 text-body-sm text-ink-muted">{description}</p>
                </div>
              </Card>
            </Reveal>
          ))}
        </ul>
      </Section>
      <MethodSection />
      <Section>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-h3">Travaillons ensemble</h2>
            <p className="text-body text-ink-muted">{brand?.serviceArea}</p>
          </div>
          <Button asChild size="lg">
            <Link to="/contact">Nous contacter</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
