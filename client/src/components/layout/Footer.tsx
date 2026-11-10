import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { CLIENT_PROFILES, PROFILE_META, formatCiPhone } from '@kodav/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Logo } from '~/components/site/Logo';
import { telLink } from '~/lib/format';
import { useBrand, usePoles } from '~/lib/useSettings';

const socialLabels = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  tiktok: 'TikTok',
} as const;

const linkClass = 'text-body-sm text-on-band-muted hover:text-on-band hover:underline';

export function Footer() {
  const { t } = useTranslation();
  const brand = useBrand();
  const poles = usePoles();
  // Un lien vide = réseau masqué.
  const socials = brand
    ? (Object.keys(socialLabels) as (keyof typeof socialLabels)[]).filter((k) => brand.social[k])
    : [];
  const tel = brand && telLink(brand.phone);

  return (
    <footer className="on-band bg-band text-on-band">
      <div className="container-page grid gap-10 py-12 sm:py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          <Logo onBand />
          {brand && <p className="text-body-sm text-on-band-muted">{brand.tagline}</p>}
          {socials.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {socials.map((key) => (
                <li key={key}>
                  <a
                    href={brand!.social[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-full border border-slate px-3 py-1 text-caption text-on-band hover:bg-slate"
                  >
                    {socialLabels[key]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav aria-label={t('footer.services')}>
          <h2 className="mb-3 text-overline text-gold">{t('footer.services')}</h2>
          <ul className="flex flex-col gap-2">
            {poles.map((pole) => (
              <li key={pole.slug}>
                <Link to={`/services/${pole.slug}`} className={linkClass}>
                  {pole.name}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/contrats-maintenance" className={linkClass}>
                {t('nav.contracts')}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t('footer.company')}>
          <h2 className="mb-3 text-overline text-gold">{t('footer.company')}</h2>
          <ul className="flex flex-col gap-2">
            {CLIENT_PROFILES.map((profile) => (
              <li key={profile}>
                <Link to={`/solutions/${PROFILE_META[profile].solutionSlug}`} className={linkClass}>
                  {PROFILE_META[profile].plural}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/a-propos" className={linkClass}>
                {t('nav.about')}
              </Link>
            </li>
            <li>
              <Link to="/realisations" className={linkClass}>
                {t('nav.projects')}
              </Link>
            </li>
            <li>
              <Link to="/faq" className={linkClass}>
                {t('nav.faq')}
              </Link>
            </li>
          </ul>
        </nav>

        {brand && (
          <div>
            <h2 className="mb-3 text-overline text-gold">{t('footer.contact')}</h2>
            <ul className="flex flex-col gap-3 text-body-sm text-on-band-muted">
              <li className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                {tel ? (
                  <a href={tel} className="hover:text-on-band hover:underline">
                    {formatCiPhone(brand.phone)}
                  </a>
                ) : (
                  <span>{brand.phone}</span>
                )}
              </li>
              <li className="flex gap-2">
                <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a href={`mailto:${brand.email}`} className="hover:text-on-band hover:underline">
                  {brand.email}
                </a>
              </li>
              <li className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{brand.serviceArea}</span>
              </li>
              <li className="flex gap-2">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {brand.openingHours.map((h) => (
                    <span key={h.days} className="block">
                      {h.days} : {h.hours}
                    </span>
                  ))}
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-slate">
        <div className="container-page flex flex-col gap-3 py-6 text-caption text-on-band-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {brand?.legalName}. {t('footer.rights')}
          </p>
          <ul className="flex flex-wrap gap-4">
            <li>
              <Link to="/mentions-legales" className="hover:text-on-band hover:underline">
                {t('footer.legal')}
              </Link>
            </li>
            <li>
              <Link to="/confidentialite" className="hover:text-on-band hover:underline">
                {t('footer.privacy')}
              </Link>
            </li>
            <li>
              <Link to="/cgv" className="hover:text-on-band hover:underline">
                {t('footer.terms')}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
