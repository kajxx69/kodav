import type { Faq } from '@kodav/shared';
import { Link } from 'react-router';
import { Section, SectionHeader } from '~/components/site/Section';
import { Accordion, Button } from '~/components/ui';

export function FaqSection({ faqs }: { faqs: Faq[] }) {
  if (faqs.length === 0) return null;
  return (
    <Section>
      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
        <SectionHeader
          overline="Questions fréquentes"
          title="Vous vous demandez peut-être…"
          action={
            <Button asChild variant="outline" className="self-start">
              <Link to="/faq">Toute la FAQ</Link>
            </Button>
          }
          align="left"
        />
        <Accordion
          items={faqs.slice(0, 5).map((f) => ({ id: f.id, title: f.question, content: f.answer }))}
        />
      </div>
    </Section>
  );
}
