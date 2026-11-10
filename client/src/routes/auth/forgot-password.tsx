import { Link } from 'react-router';
import { ForgotPasswordForm } from '~/features/auth/PasswordResetForms';
import { pageMeta } from '~/lib/seo';
import { AuthCard } from '~/components/app/AuthCard';
import type { Route } from './+types/forgot-password';

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Mot de passe oublié',
    description: 'Recevez un lien pour choisir un nouveau mot de passe.',
    path: '/mot-de-passe-oublie',
    noindex: true,
  });
}

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      lead="Indiquez l’email de votre compte : nous vous envoyons un lien pour en choisir un nouveau."
      footer={
        <Link to="/connexion" className="text-label text-link underline">
          Retour à la connexion
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
