import { NotFoundContent } from '~/components/site/NotFoundContent';
import { pageMeta } from '~/lib/seo';
import type { Route } from './+types/not-found';

export function meta({ matches, location }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Page introuvable',
    description: "Cette page n'existe pas.",
    path: location.pathname,
    noindex: true,
  });
}

export default function NotFound() {
  return (
    <div className="container-page grid place-items-center py-16 sm:py-24">
      <NotFoundContent />
    </div>
  );
}
