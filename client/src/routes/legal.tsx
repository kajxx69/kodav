import { useLocation } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { RichText } from '~/components/site/RichText';
import { Section } from '~/components/site/Section';
import { legalPages, type LegalPath } from '~/content/legal';
import { normalizePath, pageMeta } from '~/lib/seo';
import { useBrand } from '~/lib/useSettings';
import type { Route } from './+types/legal';

export function meta({ matches, location }: Route.MetaArgs) {
  const page = legalPages[normalizePath(location.pathname) as LegalPath];
  return pageMeta(matches, {
    title: page.title,
    description: page.description,
    path: normalizePath(location.pathname),
  });
}

export default function Legal() {
  const { pathname } = useLocation();
  const brand = useBrand();
  const page = legalPages[normalizePath(pathname) as LegalPath];
  const body = page.body.replace(
    /\{(legalName|email|phone|address)\}/g,
    (_, key: 'legalName' | 'email' | 'phone' | 'address') => (brand ? brand[key] : '[à compléter]'),
  );
  return (
    <>
      <PageHero title={page.title} crumbs={[{ label: page.title }]} />
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="mb-6 rounded-md bg-warning-soft px-4 py-3 text-body-sm text-warning">
            Document modèle en cours de finalisation : à faire relire par un juriste avant la mise
            en ligne.
          </p>
          <RichText text={body} />
        </div>
      </Section>
    </>
  );
}
