import { Link } from 'react-router';
import { RegisterForm } from '~/features/auth/RegisterForm';
import { pageMeta } from '~/lib/seo';
import { AuthCard } from '~/components/app/AuthCard';
import type { Route } from './+types/register';

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Créer un compte',
    description: 'Créez votre espace client pour suivre vos demandes et interventions.',
    path: '/inscription',
    noindex: true,
  });
}

export default function RegisterPage() {
  return (
    <AuthCard
      wide
      title="Créer un compte"
      lead="Suivez vos devis, vos interventions et votre parc informatique au même endroit."
      footer={
        <>
          Déjà un compte ?{' '}
          <Link to="/connexion" className="text-label text-link underline">
            Se connecter
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
