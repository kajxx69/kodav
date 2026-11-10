import type { AppointmentDto } from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileDown, Phone, Radio } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import { Alert, Button, Card, ErrorState, Modal, Skeleton, TextArea, toast } from '~/components/ui';
import {
  AppointmentInfo,
  AppointmentStatusBadge,
  AppointmentTimeline,
  ReportSummary,
} from '~/features/appointments/AppointmentView';
import { SlotPicker } from '~/features/appointments/SlotPicker';
import { apiRequest, openProtectedFile } from '~/lib/api';
import { useAppointmentLive } from '~/lib/realtime';
import { telLink } from '~/lib/format';

export default function ClientAppointment() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const key = ['private', 'appointments', id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<AppointmentDto>(`/appointments/${encodeURIComponent(id)}`),
  });
  // Chaque changement de statut recharge la fiche (technicien, rapport…).
  useAppointmentLive(id, () => void queryClient.invalidateQueries({ queryKey: key }));

  const [moveOpen, setMoveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const onDone = (a: AppointmentDto) => {
    queryClient.setQueryData(key, a);
    void queryClient.invalidateQueries({ queryKey: ['private', 'appointments'], exact: true });
    void queryClient.invalidateQueries({ queryKey: ['availability'] });
  };
  const move = useMutation({
    mutationFn: (s: string) =>
      apiRequest<AppointmentDto>(`/appointments/${id}/reschedule`, {
        method: 'POST',
        json: { start: s },
      }),
    onSuccess(a) {
      onDone(a);
      setMoveOpen(false);
      toast('Rendez-vous reporté', { variant: 'success' });
    },
  });
  const cancel = useMutation({
    mutationFn: () =>
      apiRequest<AppointmentDto>(`/appointments/${id}/cancel`, {
        method: 'POST',
        json: { reason },
      }),
    onSuccess(a) {
      onDone(a);
      setCancelOpen(false);
    },
  });

  const back = (
    <Link
      to="/espace-client/rendez-vous"
      className="inline-flex items-center gap-1 text-label text-link"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Mes rendez-vous
    </Link>
  );
  if (query.isPending) {
    return (
      <>
        {back}
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72" />
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        {back}
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      </>
    );
  }
  const a = query.data;
  const call = a.technician ? telLink(a.technician.phone) : null;
  return (
    <>
      {back}
      <SpaceHeader
        title={`Intervention ${a.reference}`}
        lead={<AppointmentStatusBadge status={a.status} />}
        actions={
          a.report?.status === 'signe' ? (
            <Button
              variant="outline"
              onClick={() =>
                openProtectedFile(`/appointments/${a.id}/report/pdf`).catch((err: Error) =>
                  toast('Rapport indisponible', { description: err.message, variant: 'error' }),
                )
              }
            >
              <FileDown aria-hidden />
              Rapport PDF
            </Button>
          ) : undefined
        }
      />
      {a.status === 'en_route' && (
        <Alert
          variant="info"
          title="Votre technicien est en route"
          action={
            call ? (
              <Button asChild variant="outline" size="sm">
                <a href={call}>
                  <Phone aria-hidden />
                  Appeler {a.technician!.firstName}
                </a>
              </Button>
            ) : undefined
          }
        />
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <h2 className="text-h4">Rendez-vous</h2>
            <AppointmentInfo appointment={a} showContact={false} />
            {a.canChange ? (
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setMoveOpen(true)}>
                  Reporter
                </Button>
                <Button variant="outline" onClick={() => setCancelOpen(true)}>
                  Annuler
                </Button>
              </div>
            ) : (
              ['demande_recue', 'planifiee'].includes(a.status) && (
                <p className="text-body-sm text-ink-muted">
                  Le rendez-vous approche : pour le modifier, contactez-nous directement.
                </p>
              )
            )}
          </Card>
          {a.report && (
            <Card className="flex flex-col gap-4">
              <h2 className="text-h4">Rapport d’intervention</h2>
              <ReportSummary appointment={a} />
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <h2 className="mb-4 flex items-center justify-between text-h4">
            Suivi
            <Radio className="size-4 text-success" aria-label="Mise à jour en direct" />
          </h2>
          <AppointmentTimeline status={a.status} history={a.statusHistory} />
        </Card>
      </div>

      <Modal
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title="Reporter le rendez-vous"
        description="Choisissez un nouveau créneau."
      >
        <div className="flex flex-col gap-4">
          {move.isError && <Alert variant="danger">{move.error.message}</Alert>}
          <SlotPicker value={start} onChange={setStart} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMoveOpen(false)}>
              Fermer
            </Button>
            <Button
              variant="secondary"
              disabled={!start}
              loading={move.isPending}
              onClick={() => start && move.mutate(start)}
            >
              Confirmer le report
            </Button>
          </div>
        </div>
      </Modal>
      <Modal open={cancelOpen} onOpenChange={setCancelOpen} title="Annuler le rendez-vous">
        <div className="flex flex-col gap-4">
          {cancel.isError && <Alert variant="danger">{cancel.error.message}</Alert>}
          <TextArea
            label="Motif (facultatif)"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Garder le rendez-vous
            </Button>
            <Button variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Confirmer l’annulation
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
