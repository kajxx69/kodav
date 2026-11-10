import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { NetworkPattern } from './NetworkPattern';

type Crumb = { label: string; to?: string };

/** En-tête de page intérieure : bandeau bleu nuit, fil d'Ariane, titre et chapeau. */
export function PageHero({
  overline,
  title,
  lead,
  crumbs,
  children,
}: {
  overline?: string;
  title: string;
  lead?: ReactNode;
  crumbs?: Crumb[];
  children?: ReactNode;
}) {
  return (
    <section className="on-band relative overflow-hidden bg-band text-on-band">
      <NetworkPattern className="absolute -top-10 right-0 hidden h-[130%] text-slate opacity-60 md:block" />
      <div className="container-page relative py-12 sm:py-16">
        {crumbs && (
          <nav aria-label="Fil d'Ariane" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1 text-body-sm text-on-band-muted">
              <li>
                <Link to="/" className="hover:text-on-band hover:underline">
                  Accueil
                </Link>
              </li>
              {crumbs.map((crumb) => (
                <li key={crumb.label} className="flex items-center gap-1">
                  <ChevronRight className="size-3.5" aria-hidden />
                  {crumb.to ? (
                    <Link to={crumb.to} className="hover:text-on-band hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-on-band">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div className="flex max-w-3xl flex-col gap-4">
          {overline && <p className="text-overline text-gold">{overline}</p>}
          <h1 className="text-h1">{title}</h1>
          {lead && <p className="text-lead text-on-band-muted">{lead}</p>}
          {children}
        </div>
      </div>
    </section>
  );
}
