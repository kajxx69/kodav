import { PROFILE_META, type ClientProfile, type Service } from '@kodav/shared';
import { Link } from 'react-router';
import { Reveal } from '~/components/site/Reveal';
import { Section, SectionHeader } from '~/components/site/Section';
import { ServiceCard } from '~/components/site/ServiceCard';
import { Button, CardGridSkeleton } from '~/components/ui';

/** Services mis en avant ; complétés par ceux qui ciblent le profil choisi. */
export function pickServices(services: Service[], profile: ClientProfile | null, max = 6) {
  const eligible = profile ? services.filter((s) => s.targetProfiles.includes(profile)) : services;
  const featured = eligible.filter((s) => s.featured);
  const others = eligible.filter((s) => !s.featured);
  return [...featured, ...others].slice(0, max);
}

export function FeaturedServices({
  services,
  profile,
}: {
  services: Service[] | undefined;
  profile: ClientProfile | null;
}) {
  const picked = services && pickServices(services, profile);
  return (
    <Section>
      <SectionHeader
        overline="Services"
        title={
          profile
            ? `Les services les plus utiles aux ${PROFILE_META[profile].plural.toLowerCase()}`
            : 'Nos services les plus demandés'
        }
        action={
          <Button asChild variant="outline">
            <Link to="/services">Tous nos services</Link>
          </Button>
        }
      />
      {picked ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {picked.map((service, i) => (
            <Reveal key={service.id} delay={i * 0.05}>
              <ServiceCard service={service} />
            </Reveal>
          ))}
        </div>
      ) : (
        <CardGridSkeleton count={6} />
      )}
    </Section>
  );
}
