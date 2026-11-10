import { Link, useSearchParams } from 'react-router';
import { LoginForm } from '~/features/auth/LoginForm';
import { pageMeta } from '~/lib/seo';
import { AuthCard } from '~/components/app/AuthCard';
import type { Route } from './+types/login';

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Connexion',
    description: 'Accédez à votre espace client KODAV.',
    path: '/connexion',
    noindex: true,
  });
}

export default function LoginPage() {
  const [params] = useSearchParams();
  const register = params.get('redirect')
    ? `/inscription?redirect=${encodeURIComponent(params.get('redirect')!)}`
    : '/inscription';
  return (
    <AuthCard
      title="Connexion"
      lead="Retrouvez vos devis, rendez-vous et tickets de support."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to={register} className="text-label text-link underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
