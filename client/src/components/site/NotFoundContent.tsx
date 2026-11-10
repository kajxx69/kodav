import { Link } from 'react-router';
import { Button } from '~/components/ui';
import { NetworkPattern } from './NetworkPattern';

export function NotFoundContent({
  code = '404',
  title = 'Page introuvable',
  description = "Cette page n'existe pas ou a été déplacée. Le reste du réseau fonctionne parfaitement.",
}: {
  code?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex max-w-xl flex-col items-center gap-4 text-center">
      <NetworkPattern className="h-40 w-auto text-line" />
      <p className="text-ref text-gold-ink">{code}</p>
      <h1 className="text-h1">{title}</h1>
      <p className="text-lead text-ink-muted">{description}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/">Retour à l’accueil</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/services">Voir les services</Link>
        </Button>
      </div>
    </div>
  );
}
