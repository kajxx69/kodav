import { Link, useSearchParams } from 'react-router';
import { Alert, Button } from '~/components/ui';
import { ResetPasswordForm } from '~/features/auth/PasswordResetForms';
import { pageMeta } from '~/lib/seo';
import { AuthCard } from '~/components/app/AuthCard';
import type { Route } from './+types/reset-password';

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Nouveau mot de passe',
    description: 'Choisissez un nouveau mot de passe.',
    path: '/reinitialiser-mot-de-passe',
    noindex: true,
  });
}

export default function ResetPasswordPage() {
  const token = useSearchParams()[0].get('token');
  return (
    <AuthCard title="Nouveau mot de passe">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col items-start gap-4">
          <Alert variant="danger">Ce lien est incomplet. Demandez-en un nouveau.</Alert>
          <Button asChild variant="outline">
            <Link to="/mot-de-passe-oublie">Demander un nouveau lien</Link>
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
