import { zodResolver } from '@hookform/resolvers/zod';
import {
  formatFcfa,
  testimonialSubmitSchema,
  type SubscriptionDto,
  type TestimonialSubmitInput,
} from '@kodav/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShieldCheck, Star } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Modal,
  Skeleton,
  TextArea,
  TextField,
} from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { cn } from '~/lib/cn';
import { formatDate } from '~/lib/format';

/** Formule de maintenance en cours, ou invitation à découvrir les contrats. */
export function SubscriptionCard() {
  const query = useQuery({
    queryKey: ['private', 'subscription'],
    queryFn: () => apiRequest<SubscriptionDto | null>('/subscriptions/me'),
  });
  if (query.isPending) return <Skeleton className="h-28" />;
  const sub = query.data;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-surface-sunken text-slate dark:text-link">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        {sub ? (
          <div>
            <p className="text-label text-ink">
              Formule {sub.plan.name} · {sub.seats} postes
            </p>
            <p className="text-body-sm text-ink-muted">
              Délai cible d’un incident critique : {sub.plan.sla.critique} h ouvrées · depuis le{' '}
              {formatDate(sub.startDate)}
              {sub.monthlyPrice ? ` · ${formatFcfa(sub.monthlyPrice)} / mois` : ''}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-label text-ink">Pas encore de contrat de maintenance</p>
            <p className="text-body-sm text-ink-muted">
              Délais garantis, visites préventives et assistance à distance.
            </p>
          </div>
        )}
      </div>
      {!sub && (
        <Button asChild variant="outline" size="sm">
          <Link to="/contrats-maintenance">Voir les formules</Link>
        </Button>
      )}
    </Card>
  );
}

type Output = z.output<typeof testimonialSubmitSchema>;

function TestimonialForm({ onDone }: { onDone: () => void }) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TestimonialSubmitInput, unknown, Output>({
    resolver: zodResolver(testimonialSubmitSchema),
    defaultValues: { content: '', rating: 0, role: '' },
  });
  const send = useMutation({
    mutationFn: (v: Output) => apiRequest('/content/testimonials', { method: 'POST', json: v }),
  });
  if (send.isSuccess) {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success" title="Merci pour votre avis">
          Il sera publié sur le site après relecture par notre équipe.
        </Alert>
        <Button variant="secondary" className="self-end" onClick={onDone}>
          Fermer
        </Button>
      </div>
    );
  }
  return (
    <form noValidate onSubmit={handleSubmit((v) => send.mutate(v))} className="flex flex-col gap-4">
      {send.isError && <Alert variant="danger">{send.error.message}</Alert>}
      <Controller
        control={control}
        name="rating"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-label text-ink">Votre note</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} sur 5`}
                  aria-pressed={field.value === n}
                  onClick={() => field.onChange(n)}
                  className="rounded-md p-1 hover:bg-surface-sunken"
                >
                  <Star
                    className={cn(
                      'size-7',
                      n <= Number(field.value) ? 'fill-gold text-gold' : 'text-line',
                    )}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
            {errors.rating?.message && (
              <p className="mt-1 text-body-sm text-danger" role="alert">
                Choisissez une note
              </p>
            )}
          </fieldset>
        )}
      />
      <TextArea
        label="Votre avis"
        required
        rows={4}
        placeholder="Ce qui vous a plu, le problème réglé…"
        error={errors.content?.message}
        {...register('content')}
      />
      <TextField
        label="Votre fonction (facultatif)"
        placeholder="Ex. : gérante, directeur des études"
        {...register('role')}
      />
      <Checkbox
        label="J’accepte que mon avis soit publié sur le site avec mon prénom, l’initiale de mon nom et le nom de ma structure."
        error={errors.consent?.message}
        {...register('consent')}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" variant="secondary" loading={send.isPending}>
          Envoyer mon avis
        </Button>
      </div>
    </form>
  );
}

export function TestimonialPrompt() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-label text-ink">Satisfait de nos services ?</p>
          <p className="text-body-sm text-ink-muted">
            Votre avis aide d’autres clients à nous choisir. Il est publié après relecture.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Star aria-hidden />
          Donner mon avis
        </Button>
      </Card>
      <Modal open={open} onOpenChange={setOpen} title="Donner mon avis">
        {open && <TestimonialForm onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
