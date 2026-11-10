import { zodResolver } from '@hookform/resolvers/zod';
import {
  ABIDJAN_COMMUNES,
  PASSWORD_MIN_LENGTH,
  PROFILE_META,
  changePasswordInputSchema,
  updateMeInputSchema,
  updateOrganizationInputSchema,
  type AuthSession,
  type AuthUser,
  type ChangePasswordInput,
  type Organization,
  type UpdateMeInput,
  type UpdateOrganizationInput,
} from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  Alert,
  Card,
  Checkbox,
  ErrorState,
  PasswordField,
  SelectField,
  Skeleton,
  TextField,
  Button,
  toast,
} from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { applyServerErrors } from '~/lib/forms';
import { useAuthStore } from '~/stores/auth';

/** Numéro +225XXXXXXXXXX affiché sans indicatif dans un champ préfixé « +225 ». */
const localPhone = (phone: string) => phone.replace(/^\+225/, '');

function SectionCard({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="text-h4">{title}</h2>
        {lead && <p className="mt-1 text-body-sm text-ink-muted">{lead}</p>}
      </div>
      {children}
    </Card>
  );
}

type MeOutput = z.output<typeof updateMeInputSchema>;

function IdentityForm({ user }: { user: AuthUser }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
    reset,
  } = useForm<UpdateMeInput, unknown, MeOutput>({
    resolver: zodResolver(updateMeInputSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: localPhone(user.phone),
      notificationPrefs: user.notificationPrefs,
    },
  });
  const mutation = useMutation({
    mutationFn: (input: MeOutput) =>
      apiRequest<AuthUser>('/auth/me', { method: 'PATCH', json: input }),
    onSuccess(updated) {
      useAuthStore.getState().setUser(updated);
      reset({
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: localPhone(updated.phone),
        notificationPrefs: updated.notificationPrefs,
      });
      toast('Profil enregistré', { variant: 'success' });
    },
    onError(error) {
      setFormError(applyServerErrors(error, setError, ['firstName', 'lastName', 'phone']));
    },
  });

  return (
    <SectionCard title="Vos informations">
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
          value={user.email}
          readOnly
          disabled
          help="Pour changer d’adresse, contactez-nous."
        />
        <TextField
          label="Téléphone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          prefix="+225"
          required
          error={errors.phone?.message}
          {...register('phone')}
        />
        <Checkbox
          className="sm:col-span-2"
          label="Recevoir les notifications par email (devis, rendez-vous, tickets)"
          {...register('notificationPrefs.email')}
        />
        <div className="sm:col-span-2">
          <Button
            type="submit"
            variant="secondary"
            disabled={!isDirty}
            loading={mutation.isPending}
          >
            Enregistrer
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

type PasswordOutput = z.output<typeof changePasswordInputSchema>;

function PasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput, unknown, PasswordOutput>({
    resolver: zodResolver(changePasswordInputSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const mutation = useMutation({
    mutationFn: (input: PasswordOutput) =>
      apiRequest<AuthSession>('/auth/me/password', { method: 'PATCH', json: input }),
    onSuccess(session) {
      useAuthStore.getState().setSession(session);
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast('Mot de passe modifié', {
        description: 'Vos autres appareils ont été déconnectés.',
        variant: 'success',
      });
    },
    onError(error) {
      setFormError(
        applyServerErrors(error, setError, ['currentPassword', 'newPassword', 'confirmPassword']),
      );
    },
  });

  return (
    <SectionCard title="Mot de passe" lead="Le changement déconnecte vos autres appareils.">
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
        <PasswordField
          label="Mot de passe actuel"
          autoComplete="current-password"
          required
          containerClassName="sm:col-span-2"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordField
          label="Nouveau mot de passe"
          autoComplete="new-password"
          required
          help={`Au moins ${PASSWORD_MIN_LENGTH} caractères, dont une lettre et un chiffre.`}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <PasswordField
          label="Confirmation"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div className="sm:col-span-2">
          <Button type="submit" variant="secondary" loading={mutation.isPending}>
            Changer le mot de passe
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

type OrgOutput = z.output<typeof updateOrganizationInputSchema>;
const communeOptions = [...ABIDJAN_COMMUNES, 'Hors Abidjan'].map((c) => ({ value: c, label: c }));

function OrganizationForm({ org, canEdit }: { org: Organization; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateOrganizationInput, unknown, OrgOutput>({
    resolver: zodResolver(updateOrganizationInputSchema),
    defaultValues: { ...org, phone: localPhone(org.phone) },
  });
  const mutation = useMutation({
    mutationFn: (input: OrgOutput) =>
      apiRequest<Organization>('/organizations/me', { method: 'PATCH', json: input }),
    onSuccess(updated) {
      queryClient.setQueryData(['private', 'organization'], updated);
      reset({ ...updated, phone: localPhone(updated.phone) });
      const user = useAuthStore.getState().user;
      if (user?.organization) {
        useAuthStore.getState().setUser({
          ...user,
          organization: { ...user.organization, name: updated.name },
        });
      }
      toast('Organisation enregistrée', { variant: 'success' });
    },
    onError(error) {
      setFormError(applyServerErrors(error, setError, ['name', 'phone', 'email', 'taxId', 'rccm']));
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
      <fieldset disabled={!canEdit} className="contents">
        {formError && (
          <Alert variant="danger" className="sm:col-span-2">
            {formError}
          </Alert>
        )}
        <TextField
          label="Nom"
          required
          containerClassName="sm:col-span-2"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Téléphone"
          type="tel"
          prefix="+225"
          error={errors.phone?.message}
          {...register('phone')}
        />
        <TextField
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="N° de compte contribuable"
          error={errors.taxId?.message}
          {...register('taxId')}
        />
        <TextField label="RCCM" error={errors.rccm?.message} {...register('rccm')} />
        <TextField
          label="Adresse"
          containerClassName="sm:col-span-2"
          {...register('address.street')}
        />
        <SelectField
          label="Commune"
          options={communeOptions}
          placeholder="Choisir…"
          {...register('address.commune')}
        />
        <TextField label="Ville" {...register('address.city')} />
      </fieldset>
      {canEdit && (
        <div className="sm:col-span-2">
          <Button
            type="submit"
            variant="secondary"
            disabled={!isDirty}
            loading={mutation.isPending}
          >
            Enregistrer
          </Button>
        </div>
      )}
    </form>
  );
}

function OrganizationSection({ user }: { user: AuthUser }) {
  const query = useQuery({
    queryKey: ['private', 'organization'],
    queryFn: () => apiRequest<Organization>('/organizations/me'),
  });
  const typeLabel = user.organization ? PROFILE_META[user.organization.type].label : '';
  const canEdit = user.orgRole === 'owner';
  return (
    <SectionCard
      title="Organisation"
      lead={
        canEdit
          ? `${typeLabel}. Ces informations figurent sur vos devis et factures.`
          : `${typeLabel}. Seul le responsable du compte peut modifier ces informations.`
      }
    >
      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <OrganizationForm org={query.data} canEdit={canEdit} />
      )}
    </SectionCard>
  );
}

/** Profil commun aux trois espaces ; la partie organisation ne concerne que les clients. */
export function ProfileSettings() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <div className="grid gap-6">
      <IdentityForm user={user} />
      {user.role === 'client' && user.organization && <OrganizationSection user={user} />}
      <PasswordForm />
    </div>
  );
}
