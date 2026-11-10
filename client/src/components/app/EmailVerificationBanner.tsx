import { useMutation } from '@tanstack/react-query';
import { Alert, Button } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { useAuthStore } from '~/stores/auth';

/** Rappel tant que l'email n'est pas confirmé, avec renvoi du lien. */
export function EmailVerificationBanner() {
  const user = useAuthStore((s) => s.user);
  const resend = useMutation({
    mutationFn: () =>
      apiRequest('/auth/resend-verification', { method: 'POST', json: { email: user?.email } }),
  });
  if (!user || user.emailVerified) return null;
  return (
    <Alert
      variant="warning"
      title="Confirmez votre adresse email"
      action={
        resend.isSuccess ? (
          <p className="text-body-sm text-ink">Lien envoyé à {user.email}.</p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            loading={resend.isPending}
            onClick={() => resend.mutate()}
          >
            Renvoyer le lien
          </Button>
        )
      }
    >
      Nous avons envoyé un lien à {user.email}. Il nous permet de vous joindre en toute sécurité
      (devis, rappels de rendez-vous).
      {resend.isError && <span className="block text-danger">{resend.error.message}</span>}
    </Alert>
  );
}
