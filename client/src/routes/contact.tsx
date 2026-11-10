import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { formatCiPhone } from '@kodav/shared';
import { useSearchParams } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { Section } from '~/components/site/Section';
import { Card } from '~/components/ui';
import { ContactForm } from '~/features/contact/ContactForm';
import { telLink, whatsappLink } from '~/lib/format';
import { pageMeta } from '~/lib/seo';
import { useBrand } from '~/lib/useSettings';
import type { Route } from './+types/contact';

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Contact',
    description:
      'Contactez-nous pour un dépannage, un projet ou un contrat de maintenance informatique à Abidjan.',
    path: '/contact',
  });
}

export default function Contact() {
  const brand = useBrand();
  const [params] = useSearchParams();
  const tel = brand && telLink(brand.phone);
  const wa =
    brand && whatsappLink(brand.whatsapp, `Bonjour ${brand.shortName}, j'ai une question.`);

  return (
    <>
      <PageHero
        overline="Contact"
        title="Parlons de votre besoin"
        lead="Un message, un appel ou WhatsApp : nous vous répondons pendant nos horaires d’ouverture."
        crumbs={[{ label: 'Contact' }]}
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ContactForm defaultSubject={params.get('sujet') ?? ''} />
          {brand && (
            <aside className="flex flex-col gap-4">
              <Card className="flex flex-col gap-4">
                <h2 className="text-h4">Coordonnées</h2>
                <ul className="flex flex-col gap-3 text-body-sm">
                  <li className="flex gap-3">
                    <Phone className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
                    {tel ? (
                      <a href={tel} className="text-link hover:underline">
                        {formatCiPhone(brand.phone)}
                      </a>
                    ) : (
                      <span>{brand.phone}</span>
                    )}
                  </li>
                  {wa && (
                    <li className="flex gap-3">
                      <MessageCircle
                        className="mt-0.5 size-4 shrink-0 text-ink-muted"
                        aria-hidden
                      />
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link hover:underline"
                      >
                        WhatsApp : {formatCiPhone(brand.whatsapp)}
                      </a>
                    </li>
                  )}
                  <li className="flex gap-3">
                    <Mail className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
                    <a href={`mailto:${brand.email}`} className="text-link hover:underline">
                      {brand.email}
                    </a>
                  </li>
                  <li className="flex gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />
                    <span>
                      {brand.address}
                      <span className="block text-ink-muted">{brand.serviceArea}</span>
                    </span>
                  </li>
                </ul>
              </Card>
              <Card className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-h4">
                  <Clock className="size-5 text-ink-muted" aria-hidden />
                  Horaires
                </h2>
                <dl className="flex flex-col gap-2 text-body-sm">
                  {brand.openingHours.map((h) => (
                    <div key={h.days} className="flex justify-between gap-4">
                      <dt className="text-ink-muted">{h.days}</dt>
                      <dd>{h.hours}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </aside>
          )}
        </div>
      </Section>
    </>
  );
}
