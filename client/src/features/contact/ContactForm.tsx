import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck } from 'lucide-react';
import {
  ABIDJAN_COMMUNES,
  CLIENT_PROFILES,
  PROFILE_META,
  contactInputSchema,
  type ContactInput,
} from '@kodav/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button, Checkbox, SelectField, TextArea, TextField, toast } from '~/components/ui';
import { ApiRequestError, apiRequest } from '~/lib/api';
import { useProfileStore } from '~/stores/profile';

type ContactOutput = z.output<typeof contactInputSchema>;

const profileOptions = CLIENT_PROFILES.map((p) => ({ value: p, label: PROFILE_META[p].label }));
const communeOptions = [...ABIDJAN_COMMUNES, 'Hors Abidjan'].map((c) => ({ value: c, label: c }));

export function ContactForm({ defaultSubject = '' }: { defaultSubject?: string }) {
  const profile = useProfileStore((s) => s.profile);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<ContactInput, unknown, ContactOutput>({
    resolver: zodResolver(contactInputSchema),
    defaultValues: { subject: defaultSubject, website: '' },
  });

  // Profil « Je suis… » mémorisé : pré-remplissage si le visiteur n'a rien choisi ici.
  useEffect(() => {
    if (profile && !getValues('profile')) setValue('profile', profile);
  }, [profile, getValues, setValue]);

  const mutation = useMutation({
    mutationFn: (input: ContactOutput) => apiRequest('/contact', { method: 'POST', json: input }),
    onSuccess: () => reset(),
    onError: (error) => {
      if (error instanceof ApiRequestError && error.details) {
        for (const d of error.details)
          setError(d.path as keyof ContactInput, { message: d.message });
        return;
      }
      toast('Envoi impossible', { description: error.message, variant: 'error' });
    },
  });

  if (mutation.isSuccess) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-lg bg-success-soft p-6">
        <CircleCheck className="size-8 text-success" aria-hidden />
        <h2 className="text-h4">Message bien reçu</h2>
        <p className="text-body text-ink">
          Merci. Nous revenons vers vous rapidement, par téléphone ou par email, pendant nos
          horaires d’ouverture.
        </p>
        <Button variant="outline" onClick={() => mutation.reset()}>
          Envoyer un autre message
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="grid gap-5 sm:grid-cols-2"
    >
      <TextField
        label="Nom et prénom"
        autoComplete="name"
        required
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        label="Téléphone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        prefix="+225"
        placeholder="07 07 00 00 00"
        help="10 chiffres"
        required
        error={errors.phone?.message}
        {...register('phone')}
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
        label="Entreprise ou établissement"
        autoComplete="organization"
        error={errors.company?.message}
        {...register('company')}
      />
      <SelectField
        label="Vous êtes"
        options={profileOptions}
        placeholder="Choisir…"
        error={errors.profile?.message}
        {...register('profile', { setValueAs: (v: string) => v || undefined })}
      />
      <SelectField
        label="Commune"
        options={communeOptions}
        placeholder="Choisir…"
        error={errors.commune?.message}
        {...register('commune', { setValueAs: (v: string) => v || undefined })}
      />
      <TextField
        label="Sujet"
        required
        containerClassName="sm:col-span-2"
        error={errors.subject?.message}
        {...register('subject')}
      />
      <TextArea
        label="Votre message"
        required
        containerClassName="sm:col-span-2"
        error={errors.message?.message}
        {...register('message')}
      />
      {/* Pot de miel : invisible et ignoré par les lecteurs d'écran. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site web
          <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </label>
      </div>
      <Checkbox
        className="sm:col-span-2"
        label="J’accepte que mes données soient utilisées pour répondre à ma demande, conformément à la politique de confidentialité."
        error={errors.consent?.message}
        {...register('consent')}
      />
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={mutation.isPending}>
          Envoyer le message
        </Button>
      </div>
    </form>
  );
}
