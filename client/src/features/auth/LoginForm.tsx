import { zodResolver } from '@hookform/resolvers/zod';
import { ROLE_HOME, loginInputSchema, type AuthSession, type LoginInput } from '@kodav/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { z } from 'zod';
import { Alert, Button, PasswordField, TextField } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { safeRedirectPath } from '~/lib/session';
import { useAuthStore } from '~/stores/auth';

type LoginOutput = z.output<typeof loginInputSchema>;

export function LoginForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput, unknown, LoginOutput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (input: LoginOutput) =>
      apiRequest<AuthSession>('/auth/login', { method: 'POST', json: input }),
    onSuccess(session) {
      useAuthStore.getState().setSession(session);
      const next = safeRedirectPath(params.get('redirect'));
      navigate(next ?? ROLE_HOME[session.user.role], { replace: true });
    },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex flex-col gap-5"
    >
      {mutation.error && <Alert variant="danger">{mutation.error.message}</Alert>}
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <div className="flex flex-col gap-2">
        <PasswordField
          label="Mot de passe"
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register('password')}
        />
        <Link to="/mot-de-passe-oublie" className="self-end text-body-sm text-link underline">
          Mot de passe oublié ?
        </Link>
      </div>
      <Button type="submit" size="lg" loading={mutation.isPending}>
        Se connecter
      </Button>
    </form>
  );
}
