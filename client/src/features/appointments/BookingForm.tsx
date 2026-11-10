import { zodResolver } from '@hookform/resolvers/zod';
import {
  ABIDJAN_COMMUNES,
  INTERVENTION_MODE_LABELS,
  bookAppointmentSchema,
  type AppointmentDto,
  type BookAppointmentInput,
  type InterventionMode,
  type Service,
} from '@kodav/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';
import {
  Alert,
  Button,
  Checkbox,
  ChoiceCards,
  SelectField,
  Stepper,
  TextArea,
  TextField,
} from '~/components/ui';
import { ApiRequestError, apiRequest } from '~/lib/api';
import { applyServerErrors } from '~/lib/forms';
import { useAuthStore } from '~/stores/auth';
import { SlotPicker, formatSlot } from './SlotPicker';

type FormOutput = z.output<typeof bookAppointmentSchema>;
const STEPS = ['Besoin', 'Créneau', 'Coordonnées'] as const;
const MODE_HINTS: Record<InterventionMode, string> = {
  sur_site: 'Un technicien se déplace chez vous',
  distance: 'Prise en main à distance sécurisée',
  atelier: 'Vous déposez le matériel',
};
const FIELDS = [
  'start',
  'contact.name',
  'contact.email',
  'contact.phone',
  'address.commune',
  'address.street',
  'description',
  'consent',
];

export function BookingForm({
  services,
  initialServiceId,
  quoteId,
}: {
  services: Service[];
  initialServiceId?: string;
  quoteId?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const initialService = services.find((s) => s.id === initialServiceId);
  const {
    register,
    control,
    setValue,
    getValues,
    trigger,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<BookAppointmentInput, unknown, FormOutput>({
    resolver: zodResolver(bookAppointmentSchema),
    defaultValues: {
      mode: initialService?.modes[0] ?? 'sur_site',
      serviceId: initialService?.id,
      quoteId,
      description: '',
      contact: {
        name: user ? `${user.firstName} ${user.lastName}` : '',
        email: user?.email ?? '',
        phone: user?.phone.replace(/^\+225/, '') ?? '',
      },
      address: { street: '', landmark: '' },
      website: '',
    },
  });
  const [mode, start, serviceId] = useWatch({ control, name: ['mode', 'start', 'serviceId'] });

  // Session restaurée après le premier affichage (rechargement) : on complète les champs vides.
  useEffect(() => {
    if (!user) return;
    const fill = (name: 'contact.name' | 'contact.email' | 'contact.phone', value: string) => {
      if (value && !getValues(name)) setValue(name, value);
    };
    fill('contact.name', `${user.firstName} ${user.lastName}`);
    fill('contact.email', user.email);
    fill('contact.phone', user.phone.replace(/^\+225/, ''));
  }, [user, getValues, setValue]);

  const go = async (next: number) => {
    if (next > step) {
      const fields = step === 0 ? (['mode', 'description'] as const) : (['start'] as const);
      if (!(await trigger(fields))) return;
    }
    setStep(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const mutation = useMutation({
    mutationFn: (values: FormOutput) =>
      apiRequest<AppointmentDto>('/appointments', { method: 'POST', json: values }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError(error) {
      // Créneau pris entre-temps : retour au choix du créneau, liste rafraîchie.
      if (error instanceof ApiRequestError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ['availability'] });
        setValue('start', '');
        setStep(1);
      }
      setFormError(applyServerErrors(error, setError, FIELDS));
    },
  });

  if (mutation.data) {
    const a = mutation.data;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        role="status"
        className="mx-auto flex max-w-2xl flex-col items-start gap-4 rounded-lg border border-line bg-surface-raised p-6 shadow-sm sm:p-8"
      >
        <CircleCheck className="size-10 text-success" aria-hidden />
        <h2 className="text-h2">Rendez-vous enregistré</h2>
        <p className="text-body text-ink-muted">
          Référence <strong className="text-ink">{a.reference}</strong>, le{' '}
          <span className="text-ink">{formatSlot(a.start)}</span>. Une confirmation part à{' '}
          {a.contact.email} ; nous vous indiquons le technicien très vite et vous rappelons la
          veille.
        </p>
        <Button asChild>
          <Link
            to={
              a.hasAccount
                ? `/espace-client/rendez-vous/${a.id}`
                : `/suivi?reference=${a.reference}`
            }
          >
            Suivre l’intervention
          </Link>
        </Button>
      </motion.div>
    );
  }

  const selected = services.find((s) => s.id === serviceId);
  const modes: InterventionMode[] = selected?.modes.length
    ? selected.modes
    : ['sur_site', 'distance', 'atelier'];

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        mutation.mutate(values);
      })}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <Stepper steps={STEPS} current={step} />
      <h2 ref={headingRef} tabIndex={-1} className="text-h3 outline-none">
        {step + 1}. {STEPS[step]}
      </h2>
      {formError && <Alert variant="danger">{formError}</Alert>}
      {quoteId && step === 0 && (
        <Alert variant="info">Ce rendez-vous sera rattaché à votre devis accepté.</Alert>
      )}

      <div className={step === 0 ? 'flex flex-col gap-6' : 'hidden'}>
        <SelectField
          label="Prestation (facultatif)"
          placeholder="Je ne sais pas encore"
          options={services.map((s) => ({ value: s.id, label: s.name }))}
          {...register('serviceId', {
            setValueAs: (v: string) => v || undefined,
            onChange: (e: { target: { value: string } }) => {
              const s = services.find((x) => x.id === e.target.value);
              if (s?.modes.length && !s.modes.includes(mode)) setValue('mode', s.modes[0]!);
            },
          })}
        />
        <ChoiceCards
          legend="Où intervenir ?"
          columns={3}
          value={mode}
          onChange={(m) => setValue('mode', m, { shouldValidate: true })}
          choices={modes.map((m) => ({
            value: m,
            label: INTERVENTION_MODE_LABELS[m],
            description: MODE_HINTS[m],
          }))}
        />
        <TextArea
          label="Décrivez votre besoin"
          required
          placeholder="Ex. : l’imprimante du bureau ne répond plus depuis ce matin."
          error={errors.description?.message}
          {...register('description')}
        />
      </div>

      <div className={step === 1 ? 'flex flex-col gap-3' : 'hidden'}>
        <SlotPicker
          value={start || null}
          onChange={(s) => setValue('start', s, { shouldValidate: true })}
        />
        {errors.start?.message && (
          <p className="text-body-sm text-danger" role="alert">
            {errors.start.message}
          </p>
        )}
      </div>

      {step === 2 && (
        <div className="grid gap-5 sm:grid-cols-2">
          <p className="rounded-md bg-surface-sunken px-4 py-3 text-body-sm text-ink sm:col-span-2">
            {INTERVENTION_MODE_LABELS[mode]} ·{' '}
            <span className="first-letter:uppercase">{start ? formatSlot(start) : ''}</span>
          </p>
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
            containerClassName="sm:col-span-2"
            error={errors.contact?.email?.message}
            {...register('contact.email')}
          />
          {mode === 'sur_site' && (
            <>
              <SelectField
                label="Commune"
                required
                placeholder="Choisir…"
                options={[...ABIDJAN_COMMUNES, 'Hors Abidjan'].map((c) => ({ value: c, label: c }))}
                error={errors.address?.commune?.message}
                {...register('address.commune', { setValueAs: (v: string) => v || undefined })}
              />
              <TextField
                label="Quartier, rue"
                autoComplete="street-address"
                {...register('address.street')}
              />
              <TextField
                label="Point de repère"
                placeholder="Ex. : face à la pharmacie, 2e étage"
                help="Aide le technicien à vous trouver."
                containerClassName="sm:col-span-2"
                {...register('address.landmark')}
              />
            </>
          )}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Site web
              <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
            </label>
          </div>
          <Checkbox
            className="sm:col-span-2"
            label="J’accepte que mes données soient utilisées pour organiser l’intervention, conformément à la politique de confidentialité."
            error={errors.consent?.message}
            {...register('consent')}
          />
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-5">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => void go(step - 1)}>
            Retour
          </Button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <Button type="button" variant="secondary" onClick={() => void go(step + 1)}>
            Continuer
          </Button>
        ) : (
          <Button type="submit" size="lg" loading={mutation.isPending}>
            Confirmer le rendez-vous
          </Button>
        )}
      </div>
    </form>
  );
}
