import { zodResolver } from '@hookform/resolvers/zod';
import {
  CLIENT_PROFILES,
  PASSWORD_MIN_LENGTH,
  PROFILE_META,
  ROLE_HOME,
  registerInputSchema,
  type AuthSession,
  type RegisterInput,
} from '@kodav/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import type { z } from 'zod';
import { Alert, Button, Checkbox, PasswordField, SelectField, TextField } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { applyServerErrors } from '~/lib/forms';
import { useAuthStore } from '~/stores/auth';
import { useProfileStore } from '~/stores/profile';

type RegisterOutput = z.output<typeof registerInputSchema>;

const FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'password',
  'profile',
  'organizationName',
  'consent',
] as const;

const profileOptions = CLIENT_PROFILES.map((p) => ({ value: p, label: PROFILE_META[p].label }));

const orgLabels = {
  pme: 'Nom de l’entreprise ou du commerce',
  ecole: 'Nom de l’établissement',
  grande_entreprise: 'Nom de l’entreprise ou de l’administration',
} as const;

export function RegisterForm() {
  const navigate = useNavigate();
  const rememberedProfile = useProfileStore((s) => s.profile);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterOutput>({
    resolver: zodResolver(registerInputSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      organizationName: '',
      website: '',
    },
  });
  const profile = useWatch({ control, name: 'profile' });

  // Profil « Je suis… » choisi sur le site : pré-sélectionné.
  useEffect(() => {
    if (rememberedProfile && !getValues('profile')) setValue('profile', rememberedProfile);
  }, [rememberedProfile, getValues, setValue]);

  const mutation = useMutation({
    mutationFn: (input: RegisterOutput) =>
      apiRequest<AuthSession>('/auth/register', { method: 'POST', json: input }),
    onSuccess(session) {
      useAuthStore.getState().setSession(session);
      navigate(ROLE_HOME[session.user.role], { replace: true, state: { welcome: true } });
    },
    onError(error) {
      setFormError(applyServerErrors(error, setError, FIELDS));
    },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        mutation.mutate(values);
      })}
      className="grid gap-5 sm:grid-cols-2"
    >
      {formError && (
        <Alert variant="danger" className="sm:col-span-2">
          {formError}
        </Alert>
      )}
      <SelectField
        label="Vous êtes"
        options={profileOptions}
        placeholder="Choisir…"
        required
        containerClassName="sm:col-span-2"
        error={errors.profile?.message}
        {...register('profile')}
      />
      {profile && profile !== 'particulier' && (
        <TextField
          label={orgLabels[profile]}
          autoComplete="organization"
          required
          help="Vos collègues pourront ensuite être rattachés à ce compte."
          containerClassName="sm:col-span-2"
          error={errors.organizationName?.message}
          {...register('organizationName')}
        />
      )}
      <TextField
        label="Prénom"
        autoComplete="given-name"
        required
        error={errors.firstName?.message}
        {...register('firstName')}
      />
      <TextField
        label="Nom"
        autoComplete="family-name"
        required
        error={errors.lastName?.message}
        {...register('lastName')}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label="Téléphone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        prefix="+225"
        placeholder="07 07 00 00 00"
        required
        error={errors.phone?.message}
        {...register('phone')}
      />
      <PasswordField
        label="Mot de passe"
        autoComplete="new-password"
        required
        help={`Au moins ${PASSWORD_MIN_LENGTH} caractères, dont une lettre et un chiffre.`}
        containerClassName="sm:col-span-2"
        error={errors.password?.message}
        {...register('password')}
      />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site web
          <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </label>
      </div>
      <Checkbox
        className="sm:col-span-2"
        label={
          <>
            J’accepte les{' '}
            <Link to="/cgv" className="text-link underline">
              conditions générales
            </Link>{' '}
            et la{' '}
            <Link to="/confidentialite" className="text-link underline">
              politique de confidentialité
            </Link>
            .
          </>
        }
        error={errors.consent?.message}
        {...register('consent')}
      />
      <Button type="submit" size="lg" className="sm:col-span-2" loading={mutation.isPending}>
        Créer mon compte
      </Button>
    </form>
  );
}
