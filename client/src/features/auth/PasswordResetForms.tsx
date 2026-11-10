import { zodResolver } from '@hookform/resolvers/zod';
import {
  PASSWORD_MIN_LENGTH,
  emailOnlySchema,
  resetPasswordInputSchema,
  type EmailOnlyInput,
  type ResetPasswordInput,
} from '@kodav/shared';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';
import { Alert, Button, PasswordField, TextField } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { applyServerErrors } from '~/lib/forms';

type EmailOutput = z.output<typeof emailOnlySchema>;
type ResetOutput = z.output<typeof resetPasswordInputSchema>;

export function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<EmailOnlyInput, unknown, EmailOutput>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  });
  const mutation = useMutation({
    mutationFn: (input: EmailOutput) =>
      apiRequest('/auth/forgot-password', { method: 'POST', json: input }),
  });

  if (mutation.isSuccess) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <MailCheck className="size-8 text-success" aria-hidden />
        <p className="text-body text-ink">
          Si un compte existe pour <strong>{getValues('email')}</strong>, vous allez recevoir un
          lien pour choisir un nouveau mot de passe. Il est valable 1 heure.
        </p>
        <p className="text-body-sm text-ink-muted">
          Rien reçu après quelques minutes ? Vérifiez vos courriers indésirables.
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex flex-col gap-5"
    >
      {mutation.error && <Alert variant="danger">{mutation.error.message}</Alert>}
      <TextField
        label="Email du compte"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <Button type="submit" size="lg" loading={mutation.isPending}>
        Recevoir le lien
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordInput, unknown, ResetOutput>({
    resolver: zodResolver(resetPasswordInputSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });
  const mutation = useMutation({
    mutationFn: (input: ResetOutput) =>
      apiRequest('/auth/reset-password', { method: 'POST', json: input }),
    onError(error) {
      setFormError(applyServerErrors(error, setError, ['password', 'confirmPassword']));
    },
  });

  if (mutation.isSuccess) {
    return (
      <div role="status" className="flex flex-col items-start gap-4">
        <Alert variant="success" title="Mot de passe modifié">
          Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
        </Alert>
        <Button asChild size="lg">
          <Link to="/connexion">Se connecter</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        mutation.mutate(values);
      })}
      className="flex flex-col gap-5"
    >
      {formError && (
        <Alert
          variant="danger"
          action={
            <Link to="/mot-de-passe-oublie" className="text-label text-link underline">
              Demander un nouveau lien
            </Link>
          }
        >
          {formError}
        </Alert>
      )}
      <PasswordField
        label="Nouveau mot de passe"
        autoComplete="new-password"
        required
        help={`Au moins ${PASSWORD_MIN_LENGTH} caractères, dont une lettre et un chiffre.`}
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordField
        label="Confirmez le mot de passe"
        autoComplete="new-password"
        required
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Button type="submit" size="lg" loading={mutation.isPending}>
        Enregistrer le mot de passe
      </Button>
    </form>
  );
}
