import { Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';
import { NetworkPattern } from '~/components/site/NetworkPattern';
import { ProfileSelector } from '~/components/site/ProfileSelector';
import { Button } from '~/components/ui';
import type { ProfileContent } from '~/content/profiles';

export function Hero({
  tagline,
  content,
  contentKey,
}: {
  tagline: string;
  content: ProfileContent;
  contentKey: string;
}) {
  return (
    <section className="on-band relative overflow-hidden bg-band text-on-band">
      <NetworkPattern className="absolute top-1/2 -right-24 hidden h-[120%] -translate-y-1/2 text-slate lg:block" />
      <div className="container-page relative grid gap-10 py-16 sm:py-24 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-24">
        <div className="flex max-w-3xl flex-col gap-6">
          <p className="text-overline text-gold">Services informatiques à Abidjan</p>
          <h1 className="text-display text-balance">{tagline}</h1>

          <div className="min-h-[5.5rem] sm:min-h-[3.5rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={contentKey}
                className="text-lead text-on-band-muted"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                aria-live="polite"
              >
                {content.heroLead}
              </motion.p>
            </AnimatePresence>
          </div>

          <ProfileSelector onBand />

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={content.primaryCta.to}>{content.primaryCta.label}</Link>
            </Button>
            <Button asChild size="lg" variant="outline-band">
              <Link to={content.secondaryCta.to}>{content.secondaryCta.label}</Link>
            </Button>
          </div>

          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {content.highlights.map((h) => (
              <li key={h} className="flex items-center gap-2 text-body-sm text-on-band-muted">
                <Check className="size-4 text-gold" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
