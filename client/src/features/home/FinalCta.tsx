import { Link } from 'react-router';
import { NetworkPattern } from '~/components/site/NetworkPattern';
import { Button } from '~/components/ui';
import type { ProfileContent } from '~/content/profiles';

export function FinalCta({ content }: { content: ProfileContent }) {
  return (
    <section className="on-band relative overflow-hidden bg-band text-on-band">
      <NetworkPattern className="absolute -bottom-20 -left-20 h-[140%] text-slate opacity-50" />
      <div className="container-page relative flex flex-col items-center gap-6 py-16 text-center sm:py-24">
        <h2 className="max-w-2xl text-h2">Parlons de votre projet ou de votre panne</h2>
        <p className="max-w-xl text-lead text-on-band-muted">
          Estimation en ligne en quelques minutes, ou échange direct avec un technicien.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to={content.primaryCta.to}>{content.primaryCta.label}</Link>
          </Button>
          <Button asChild size="lg" variant="outline-band">
            <Link to="/contact">Nous contacter</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
