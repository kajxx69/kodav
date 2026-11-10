import { ROLE_HOME } from '@kodav/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert, Button, Skeleton } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { pageMeta } from '~/lib/seo';
import { useAuthStore } from '~/stores/auth';
import { AuthCard } from '~/components/app/AuthCard';
import type { Route } from './+types/verify-email';

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Confirmation de l’email',
    description: 'Confirmation de votre adresse email.',
    path: '/verifier-email',
    noindex: true,
  });
}

export default function VerifyEmailPage() {
  const token = useSearchParams()[0].get('token');
  const user = useAuthStore((s) => s.user);
  const { mutate, isSuccess, isError, error } = useMutation({
    mutationFn: (value: string) =>
      apiRequest('/auth/verify-email', { method: 'POST', json: { token: value } }),
    onSuccess() {
      const current = useAuthStore.getState().user;
      if (current) useAuthStore.getState().setUser({ ...current, emailVerified: true });
    },
  });

  // Une seule tentative par lien (jeton à usage unique), y compris en StrictMode.
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!token || sent.current === token) return;
    sent.current = token;
    mutate(token);
  }, [token, mutate]);

  const next = user ? ROLE_HOME[user.role] : '/connexion';
  return (
    <AuthCard title="Confirmation de l’email">
      {!token || isError ? (
        <Alert variant="danger" title="Lien invalide ou expiré">
          {error?.message ?? 'Ce lien est incomplet.'} Vous pouvez demander un nouveau lien depuis
          votre espace.
        </Alert>
      ) : isSuccess ? (
        <Alert variant="success" title="Adresse confirmée">
          Merci, votre adresse email est confirmée.
        </Alert>
      ) : (
        <div role="status" aria-label="Vérification en cours" className="flex flex-col gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      )}
      <Button asChild size="lg" className="mt-6 w-full">
        <Link to={next}>{user ? 'Accéder à mon espace' : 'Se connecter'}</Link>
      </Button>
    </AuthCard>
  );
}
