import { HelpCircle } from 'lucide-react';
import { Link } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { Section } from '~/components/site/Section';
import { Accordion, Button, EmptyState, ErrorState, Skeleton } from '~/components/ui';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import type { Route } from './+types/faq';

export const loader = () => fetchAtBuild(queries.faqs());
export const clientLoader = () => fetchInBrowser(queries.faqs());

export function meta({ matches, loaderData }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Questions fréquentes',
    description:
      'Zone d’intervention, devis, paiement, licences, assistance à distance : les réponses à vos questions.',
    path: '/faq',
    jsonLd: loaderData?.length
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: loaderData.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : undefined,
  });
}

export default function FaqPage({ loaderData }: Route.ComponentProps) {
  const { data: faqs, isError, refetch } = useLiveQuery(queries.faqs(), loaderData);
  return (
    <>
      <PageHero overline="FAQ" title="Questions fréquentes" crumbs={[{ label: 'FAQ' }]} />
      <Section>
        <div className="mx-auto max-w-3xl">
          {isError && !faqs && <ErrorState onRetry={() => void refetch()} />}
          {!faqs && !isError && <Skeleton className="h-80 w-full" />}
          {faqs?.length === 0 && (
            <EmptyState icon={HelpCircle} title="Aucune question pour le moment" />
          )}
          {faqs && faqs.length > 0 && (
            <Accordion
              items={faqs.map((f) => ({ id: f.id, title: f.question, content: f.answer }))}
            />
          )}
          <div className="mt-10 flex flex-col items-start gap-3 rounded-lg bg-surface-sunken p-6">
            <h2 className="text-h4">Vous ne trouvez pas votre réponse ?</h2>
            <Button asChild variant="secondary">
              <Link to="/contact">Posez-nous la question</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
