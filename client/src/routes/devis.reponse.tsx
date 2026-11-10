import type { QuoteDto } from '@kodav/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { Section } from '~/components/site/Section';
import { Alert, Button, Card, Skeleton } from '~/components/ui';
import { QuoteDecision, QuoteInfo, QuoteLines, QuoteStatusBadge } from '~/features/quote/QuoteView';
import { apiRequest } from '~/lib/api';
import { pageMeta } from '~/lib/seo';
import type { Route } from './+types/devis.reponse';

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Répondre à votre devis',
    description: 'Consultez et acceptez votre devis en ligne.',
    path: '/devis/reponse',
    noindex: true,
  });
}

/** Lien sécurisé reçu par email : consultation puis acceptation ou refus, sans compte. */
export default function QuoteResponsePage() {
  const token = useSearchParams()[0].get('token') ?? '';
  const query = useQuery({
    queryKey: ['quote-action', token],
    queryFn: () => apiRequest<QuoteDto>(`/quotes/action/${encodeURIComponent(token)}`),
    enabled: Boolean(token),
    retry: false,
  });
  const decision = useMutation({
    mutationFn: (input: { decision: 'accept' | 'decline'; reason: string }) =>
      apiRequest<QuoteDto>(`/quotes/action/${encodeURIComponent(token)}`, {
        method: 'POST',
        json: input,
      }),
  });
  const quote = decision.data ?? query.data;

  return (
    <Section>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {!token || query.isError ? (
          <Alert
            variant="danger"
            title="Lien invalide ou expiré"
            action={
              <Button asChild variant="outline">
                <Link to="/connexion?redirect=%2Fespace-client%2Fdevis">Voir mes devis</Link>
              </Button>
            }
          >
            Ce lien a déjà servi ou n’est plus valable. Si vous avez un compte, retrouvez votre
            devis dans votre espace ; sinon, contactez-nous.
          </Alert>
        ) : !quote ? (
          <>
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-64" />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-h2">Devis {quote.reference}</h1>
              <QuoteStatusBadge status={quote.status} />
            </div>
            <QuoteDecision
              quote={quote}
              pending={decision.isPending}
              error={decision.error?.message ?? null}
              onDecide={(d, reason) => decision.mutate({ decision: d, reason })}
            />
            <Card className="flex flex-col gap-4">
              <QuoteLines quote={quote} />
            </Card>
            <Card>
              <QuoteInfo quote={quote} />
            </Card>
          </>
        )}
      </div>
    </Section>
  );
}
