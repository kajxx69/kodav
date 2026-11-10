import { zodResolver } from '@hookform/resolvers/zod';
import {
  INTERVENTION_MODE_LABELS,
  trackingLookupSchema,
  type TrackingDto,
  type TrackingLookupInput,
} from '@kodav/shared';
import { useMutation } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import type { z } from 'zod';
import { PageHero } from '~/components/site/PageHero';
import { Section } from '~/components/site/Section';
import { Alert, Button, Card, TextField } from '~/components/ui';
import {
  AppointmentStatusBadge,
  AppointmentTimeline,
} from '~/features/appointments/AppointmentView';
import { formatSlot } from '~/features/appointments/SlotPicker';
import { apiRequest } from '~/lib/api';
import { useAppointmentLive } from '~/lib/realtime';
import { pageMeta } from '~/lib/seo';
import type { Route } from './+types/suivi';

type Output = z.output<typeof trackingLookupSchema>;

export function meta({ matches }: Route.MetaArgs) {
  return pageMeta(matches, {
    title: 'Suivre mon intervention',
    description: 'Suivez en temps réel l’avancement de votre intervention avec sa référence.',
    path: '/suivi',
  });
}

/** Suivi public : référence + téléphone ou email, puis timeline mise à jour en direct. */
export default function TrackingPage() {
  const [params] = useSearchParams();
  const [tracking, setTracking] = useState<TrackingDto | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TrackingLookupInput, unknown, Output>({
    resolver: zodResolver(trackingLookupSchema),
    defaultValues: { reference: params.get('reference') ?? '', contact: '' },
  });
  const lookup = useMutation({
    mutationFn: (input: Output) =>
      apiRequest<TrackingDto>('/tracking/lookup', { method: 'POST', json: input }),
    onSuccess: setTracking,
  });

  // Le jeton de suivi ouvre la salle de cette intervention : chaque statut arrive en direct.
  useLiveTracking(tracking, setTracking);

  return (
    <>
      <PageHero
        overline="Suivi"
        title="Suivre mon intervention"
        lead="Saisissez la référence reçue par email (INT-…) et le téléphone ou l’email utilisé lors de la réservation."
        crumbs={[{ label: 'Suivi' }]}
      />
      <Section>
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <form
            noValidate
            onSubmit={handleSubmit((v) => lookup.mutate(v))}
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <TextField
              label="Référence"
              placeholder="INT-2026-0001"
              autoCapitalize="characters"
              error={errors.reference?.message}
              {...register('reference')}
            />
            <TextField
              label="Téléphone ou email"
              autoComplete="email"
              error={errors.contact?.message}
              {...register('contact')}
            />
            <Button type="submit" loading={lookup.isPending}>
              Suivre
            </Button>
          </form>
          {lookup.isError && <Alert variant="danger">{lookup.error.message}</Alert>}
          {tracking && (
            <Card className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-h3">{tracking.reference}</h2>
                  <p className="text-body-sm text-ink-muted first-letter:uppercase">
                    {formatSlot(tracking.start)} · {INTERVENTION_MODE_LABELS[tracking.mode]}
                    {tracking.service ? ` · ${tracking.service}` : ''}
                  </p>
                </div>
                <AppointmentStatusBadge status={tracking.status} />
              </div>
              {tracking.technicianFirstName && (
                <p className="text-body text-ink">Technicien : {tracking.technicianFirstName}</p>
              )}
              <AppointmentTimeline status={tracking.status} history={tracking.statusHistory} />
              <p className="flex items-center gap-2 text-caption text-ink-muted">
                <Radio className="size-4 text-success" aria-hidden />
                Mise à jour en direct
              </p>
            </Card>
          )}
        </div>
      </Section>
    </>
  );
}

function useLiveTracking(tracking: TrackingDto | null, setTracking: (t: TrackingDto) => void) {
  useAppointmentLive(
    tracking ? 'tracking' : null,
    (event) => {
      if (!tracking || event.reference !== tracking.reference) return;
      setTracking({
        ...tracking,
        status: event.status,
        technicianFirstName: event.technicianFirstName,
        // Un report garde le même statut : l'historique n'ajoute que les vrais changements.
        statusHistory:
          event.status === tracking.status
            ? tracking.statusHistory
            : [...tracking.statusHistory, { status: event.status, at: event.at }],
      });
    },
    tracking?.trackingToken,
  );
}
