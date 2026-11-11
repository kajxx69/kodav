import { CircleAlert } from 'lucide-react';
import { CLIENT_PROFILES, PROFILE_META, type ClientProfile } from '@kodav/shared';
import { useEffect } from 'react';
import { Link, data } from 'react-router';
import { PageHero } from '~/components/site/PageHero';
import { Reveal } from '~/components/site/Reveal';
import { Section, SectionHeader } from '~/components/site/Section';
import { ServiceCard } from '~/components/site/ServiceCard';
import { Button, CardGridSkeleton } from '~/components/ui';
import { profileContent, solutionPages } from '~/content/profiles';
import { PlansTeaser } from '~/features/home/PlansTeaser';
import { UseCases } from '~/features/home/UseCases';
import { fetchAtBuild, fetchInBrowser, useLiveQuery } from '~/lib/loaderData';
import { queries } from '~/lib/queries';
import { pageMeta } from '~/lib/seo';
import { useProfileStore } from '~/stores/profile';
import type { Route } from './+types/solutions';

function profileFromSlug(slug: string): ClientProfile {
  const profile = CLIENT_PROFILES.find((p) => PROFILE_META[p].solutionSlug === slug);
  if (!profile) throw data(null, { status: 404 });
  return profile;
}

export async function loader({ params }: Route.LoaderArgs) {
  const profile = profileFromSlug(params.profil);
  const [services, plans] = await Promise.all([
    fetchAtBuild(queries.services({ profile })),
    fetchAtBuild(queries.plans()),
  ]);
  return { services, plans };
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const profile = profileFromSlug(params.profil);
  const [services, plans] = await Promise.all([
    fetchInBrowser(queries.services({ profile })),
    fetchInBrowser(queries.plans()),
  ]);
  return { services, plans };
}

export function meta({ matches, params }: Route.MetaArgs) {
  const profile = CLIENT_PROFILES.find((p) => PROFILE_META[p].solutionSlug === params.profil);
  if (!profile) return [];
  const page = solutionPages[profile];
  return pageMeta(matches, {
    title: page.seoTitle,
    description: page.description,
    path: `/solutions/${params.profil}`,
  });
}

export default function Solution({ loaderData, params }: Route.ComponentProps) {
  const profile = profileFromSlug(params.profil);
  const page = solutionPages[profile];
  const content = profileContent[profile];
  const services = useLiveQuery(queries.services({ profile }), loaderData.services).data;
  const plans = useLiveQuery(queries.plans(), loaderData.plans).data ?? [];
  const setProfile = useProfileStore((s) => s.setProfile);

  // Visiter une page Solutions vaut choix de profil (accueil et formulaires pré-remplis).
  useEffect(() => setProfile(profile), [profile, setProfile]);

  return (
    <>
      <PageHero
        overline={PROFILE_META[profile].plural}
        title={page.title}
        lead={page.intro}
        crumbs={[{ label: 'Solutions' }, { label: PROFILE_META[profile].plural }]}
      >
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to={content.primaryCta.to}>{content.primaryCta.label}</Link>
          </Button>
          <Button asChild size="lg" variant="outline-band">
            <Link to={content.secondaryCta.to}>{content.secondaryCta.label}</Link>
          </Button>
        </div>
      </PageHero>

      <Section>
        <SectionHeader
          overline="Vous reconnaissez-vous ?"
          title="Les situations que nous réglons"
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {page.pains.map((pain, i) => (
            <Reveal
              as="li"
              key={pain}
              delay={i * 0.05}
              className="flex items-start gap-3 rounded-lg border border-line bg-surface-raised p-5"
            >
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <span className="text-body">{pain}</span>
            </Reveal>
          ))}
        </ul>
      </Section>

      <UseCases useCases={content.useCases} />

      <Section>
        <SectionHeader overline="Services" title="Les services adaptés" />
        {services ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <CardGridSkeleton count={6} />
        )}
      </Section>

      {content.showPlans && <PlansTeaser plans={plans} profile={profile} />}
    </>
  );
}
