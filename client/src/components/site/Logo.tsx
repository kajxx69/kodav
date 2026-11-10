import { Link } from 'react-router';
import logoDark from '~/brand/logos/kodav-logo-horizontal-dark.svg';
import logo from '~/brand/logos/kodav-logo-horizontal.svg';
import { cn } from '~/lib/cn';
import { useBrand } from '~/lib/useSettings';

/** Fichiers du kit de marque utilisés tels quels : version claire ou sombre selon le fond. */
export function Logo({ onBand = false, className }: { onBand?: boolean; className?: string }) {
  const brand = useBrand();
  const alt = brand?.legalName ?? '';
  return (
    <Link
      to="/"
      className={cn('inline-flex shrink-0 rounded-sm', className)}
      aria-label={brand ? `${brand.shortName}, accueil` : 'Accueil'}
    >
      {onBand ? (
        <img src={logoDark} alt={alt} width={150} height={40} className="h-9 w-auto" />
      ) : (
        <>
          <img src={logo} alt={alt} width={150} height={40} className="h-9 w-auto dark:hidden" />
          <img
            src={logoDark}
            alt={alt}
            width={150}
            height={40}
            className="hidden h-9 w-auto dark:block"
          />
        </>
      )}
    </Link>
  );
}
