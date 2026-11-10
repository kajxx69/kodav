import { zodResolver } from '@hookform/resolvers/zod';
import {
  CLIENT_PROFILES,
  PROFILE_META,
  quoteContactSchema,
  type QuoteDto,
  type QuoteSubmitInput,
} from '@kodav/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Alert, Button, Checkbox, SelectField, TextField } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { applyServerErrors } from '~/lib/forms';
import { useAuthStore } from '~/stores/auth';
import { useProfileStore } from '~/stores/profile';
import { draftSnapshot } from './draftStore';
import { NotesField } from './steps';

const formSchema = z.object({
  contact: quoteContactSchema,
  consent: z.literal(true, { error: 'Votre accord est nécessaire pour traiter la demande' }),
  website: z.string().max(500).optional().default(''),
});
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

const profileOptions = CLIENT_PROFILES.map((p) => ({ value: p, label: PROFILE_META[p].label }));
const FIELDS = [
  'contact.name',
  'contact.email',
  'contact.phone',
  'contact.profile',
  'contact.company',
  'consent',
];

export function ContactStep({
  onSubmitted,
  onBack,
}: {
  onSubmitted: (quote: QuoteDto) => void;
  onBack: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const rememberedProfile = useProfileStore((s) => s.profile);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      contact: {
        name: user ? `${user.firstName} ${user.lastName}` : '',
        email: user?.email ?? '',
        phone: user?.phone.replace(/^\+225/, '') ?? '',
        profile: user?.profile ?? rememberedProfile ?? undefined,
        company: user?.organization?.name ?? '',
      },
      website: '',
    },
  });

  // Session restaurée après le premier affichage (rechargement) : on complète les champs vides.
  useEffect(() => {
    if (!user) return;
    const values: [Parameters<typeof setValue>[0], string | null | undefined][] = [
      ['contact.name', `${user.firstName} ${user.lastName}`],
      ['contact.email', user.email],
      ['contact.phone', user.phone.replace(/^\+225/, '')],
      ['contact.profile', user.profile],
      ['contact.company', user.organization?.name],
    ];
    for (const [name, value] of values) {
      if (value && !getValues(name)) setValue(name, value as never);
    }
  }, [user, getValues, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      const { step: _step, ...draft } = draftSnapshot();
      const payload: QuoteSubmitInput = {
        ...draft,
        commune: draft.mode === 'sur_site' ? draft.commune : undefined,
        ...values,
      };
      return apiRequest<QuoteDto>('/quotes', { method: 'POST', json: payload });
    },
    onSuccess: onSubmitted,
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
      {!user && (
        <p className="text-body-sm text-ink-muted sm:col-span-2">
          Déjà client ?{' '}
          <Link to="/connexion?redirect=%2Fdevis" className="text-link underline">
            Connectez-vous
          </Link>{' '}
          pour suivre cette demande dans votre espace. Votre sélection est conservée.
        </p>
      )}
      <TextField
        label="Nom et prénom"
        autoComplete="name"
        required
        error={errors.contact?.name?.message}
        {...register('contact.name')}
      />
      <TextField
        label="Téléphone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        prefix="+225"
        required
        error={errors.contact?.phone?.message}
        {...register('contact.phone')}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        help="Vous recevez le récapitulatif en PDF à cette adresse."
        error={errors.contact?.email?.message}
        {...register('contact.email')}
      />
      <SelectField
        label="Vous êtes"
        options={profileOptions}
        placeholder="Choisir…"
        required
        error={errors.contact?.profile?.message}
        {...register('contact.profile')}
      />
      <TextField
        label="Entreprise ou établissement"
        autoComplete="organization"
        containerClassName="sm:col-span-2"
        error={errors.contact?.company?.message}
        {...register('contact.company')}
      />
      <NotesField />
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site web
          <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </label>
      </div>
      <Checkbox
        className="sm:col-span-2"
        label="J’accepte que mes données soient utilisées pour établir ce devis et me recontacter, conformément à la politique de confidentialité."
        error={errors.consent?.message}
        {...register('consent')}
      />
      <div className="flex flex-wrap justify-between gap-3 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button type="submit" size="lg" loading={mutation.isPending}>
          Envoyer ma demande
        </Button>
      </div>
    </form>
  );
}
