import { zodResolver } from '@hookform/resolvers/zod';
import { reportDraftSchema, type AppointmentDto, type ReportDraftInput } from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, FileDown, MapPin, Navigation, Phone, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import type { z } from 'zod';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Skeleton,
  TextArea,
  TextField,
  toast,
} from '~/components/ui';
import {
  AppointmentInfo,
  AppointmentStatusBadge,
  AppointmentTimeline,
  ReportPhotos,
  ReportSummary,
  mapsLink,
} from '~/features/appointments/AppointmentView';
import { SignaturePad } from '~/features/appointments/SignaturePad';
import { apiRequest, openProtectedFile } from '~/lib/api';
import { telLink } from '~/lib/format';
import { applyServerErrors } from '~/lib/forms';

type ReportOutput = z.output<typeof reportDraftSchema>;

const ACTIONS: Partial<
  Record<
    AppointmentDto['status'],
    { status: 'en_route' | 'en_cours' | 'terminee'; label: string }[]
  >
> = {
  planifiee: [
    { status: 'en_route', label: 'Je pars' },
    { status: 'en_cours', label: 'Commencer sur place' },
  ],
  en_route: [{ status: 'en_cours', label: 'Commencer l’intervention' }],
  en_cours: [{ status: 'terminee', label: 'Terminer l’intervention' }],
};

function ReportForm({
  appointment,
  onSaved,
}: {
  appointment: AppointmentDto;
  onSaved: (a: AppointmentDto) => void;
}) {
  const report = appointment.report;
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ReportDraftInput, unknown, ReportOutput>({
    resolver: zodResolver(reportDraftSchema),
    defaultValues: {
      workDone: report?.workDone ?? '',
      timeSpentMinutes: report?.timeSpentMinutes ?? 0,
      materials: report?.materials ?? [],
      clientComment: report?.clientComment ?? '',
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'materials' });
  const save = useMutation({
    mutationFn: (values: ReportOutput) =>
      apiRequest<AppointmentDto>(`/technician/appointments/${appointment.id}/report`, {
        method: 'PUT',
        json: values,
      }),
    onSuccess(a, values) {
      reset(values);
      onSaved(a);
      toast('Rapport enregistré', { variant: 'success' });
    },
    onError(error) {
      setFormError(applyServerErrors(error, setError, ['workDone', 'timeSpentMinutes']));
    },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        save.mutate(v);
      })}
      className="flex flex-col gap-4"
    >
      {formError && <Alert variant="danger">{formError}</Alert>}
      <TextArea
        label="Travaux effectués"
        required
        placeholder="Diagnostic, actions réalisées, résultat…"
        error={errors.workDone?.message}
        {...register('workDone')}
      />
      <TextField
        label="Temps passé (minutes)"
        type="number"
        inputMode="numeric"
        min={0}
        step={15}
        containerClassName="max-w-48"
        error={errors.timeSpentMinutes?.message}
        {...register('timeSpentMinutes')}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-label text-ink">Matériel utilisé</legend>
        {fields.map((field, i) => (
          <div
            key={field.id}
            className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-start gap-2"
          >
            <TextField
              label="Qté"
              type="number"
              inputMode="numeric"
              min={1}
              error={errors.materials?.[i]?.quantity?.message}
              {...register(`materials.${i}.quantity`)}
            />
            <TextField
              label="Désignation"
              error={errors.materials?.[i]?.label?.message}
              {...register(`materials.${i}.label`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-7"
              aria-label={`Retirer le matériel ${i + 1}`}
              onClick={() => remove(i)}
            >
              <Trash2 className="size-5" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => append({ quantity: 1, label: '' })}
        >
          <Plus aria-hidden />
          Ajouter du matériel
        </Button>
      </fieldset>
      <TextArea label="Commentaire du client" {...register('clientComment')} />
      <Button
        type="submit"
        variant="secondary"
        className="self-start"
        disabled={!isDirty}
        loading={save.isPending}
      >
        Enregistrer le rapport
      </Button>
    </form>
  );
}

function Photos({
  appointment,
  onSaved,
}: {
  appointment: AppointmentDto;
  onSaved: (a: AppointmentDto) => void;
}) {
  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const body = new FormData();
      for (const f of files) body.append('photos', f);
      return apiRequest<AppointmentDto>(
        `/technician/appointments/${appointment.id}/report/photos`,
        { method: 'POST', body },
      );
    },
    onSuccess: onSaved,
  });
  const remove = useMutation({
    mutationFn: (photoId: string) =>
      apiRequest<AppointmentDto>(
        `/technician/appointments/${appointment.id}/report/photos/${photoId}`,
        { method: 'DELETE' },
      ),
    onSuccess: onSaved,
  });
  const count = appointment.report?.photos.length ?? 0;
  return (
    <div className="flex flex-col gap-3">
      {(upload.error ?? remove.error) && (
        <Alert variant="danger">{(upload.error ?? remove.error)!.message}</Alert>
      )}
      <ReportPhotos appointment={appointment} />
      {count > 0 && (
        <div className="flex flex-wrap gap-2">
          {appointment.report!.photos.map((p, i) => (
            <Button
              key={p.id}
              variant="ghost"
              size="sm"
              loading={remove.isPending && remove.variables === p.id}
              onClick={() => remove.mutate(p.id)}
            >
              <Trash2 aria-hidden />
              Retirer la photo {i + 1}
            </Button>
          ))}
        </div>
      )}
      {count < 6 && (
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-field-border px-4 py-2.5 text-label text-ink hover:bg-surface-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
          <Camera className="size-5" aria-hidden />
          {upload.isPending ? 'Envoi…' : 'Ajouter des photos'}
          <input
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            multiple
            className="sr-only"
            disabled={upload.isPending}
            onChange={(e) => {
              // Copie avant de vider le champ : sa FileList est vidée avec lui.
              const files = Array.from(e.target.files ?? []);
              if (files.length) upload.mutate(files);
              e.target.value = '';
            }}
          />
        </label>
      )}
      <p className="text-caption text-ink-muted">JPEG ou PNG, 5 Mo maximum, 6 photos au plus.</p>
    </div>
  );
}

function SignatureStep({
  appointment,
  onSaved,
}: {
  appointment: AppointmentDto;
  onSaved: (a: AppointmentDto) => void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(appointment.contact.name);
  const sign = useMutation({
    mutationFn: () =>
      apiRequest<AppointmentDto>(`/technician/appointments/${appointment.id}/report/sign`, {
        method: 'POST',
        json: { signerName, signature },
      }),
    onSuccess(a) {
      onSaved(a);
      toast('Intervention validée', {
        description: 'Le client reçoit le rapport par email.',
        variant: 'success',
      });
    },
  });
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-h4">Signature du client</h2>
      <p className="text-body-sm text-ink-muted">
        Relisez le rapport avec le client, puis faites-le signer : le rapport est alors figé et
        l’intervention validée.
      </p>
      {sign.isError && <Alert variant="danger">{sign.error.message}</Alert>}
      <TextField
        label="Nom du signataire"
        value={signerName}
        onChange={(e) => setSignerName(e.target.value)}
      />
      <SignaturePad onChange={setSignature} />
      <Button
        size="lg"
        disabled={!signature || signerName.trim().length < 2}
        loading={sign.isPending}
        onClick={() => sign.mutate()}
      >
        Valider avec la signature
      </Button>
    </Card>
  );
}

export default function TechnicianIntervention() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const key = ['private', 'technician', 'appointment', id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiRequest<AppointmentDto>(`/technician/appointments/${encodeURIComponent(id)}`),
  });
  const onSaved = (a: AppointmentDto) => {
    queryClient.setQueryData(key, a);
    void queryClient.invalidateQueries({
      queryKey: ['private', 'technician'],
      exact: false,
      refetchType: 'none',
    });
  };
  const status = useMutation({
    mutationFn: (next: 'en_route' | 'en_cours' | 'terminee') =>
      apiRequest<AppointmentDto>(`/technician/appointments/${id}/status`, {
        method: 'PATCH',
        json: { status: next },
      }),
    onSuccess: onSaved,
  });

  const back = (
    <Link to="/technicien" className="inline-flex items-center gap-1 text-label text-link">
      <ArrowLeft className="size-4" aria-hidden />
      Mes interventions
    </Link>
  );
  if (query.isPending) {
    return (
      <>
        {back}
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
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
  const call = telLink(a.contact.phone);
  const actions = ACTIONS[a.status] ?? [];
  const editable = ['en_cours', 'terminee'].includes(a.status) && a.report?.status !== 'signe';

  return (
    <>
      {back}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h2">{a.reference}</h1>
        <AppointmentStatusBadge status={a.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {call && (
          <Button asChild variant="outline" size="lg">
            <a href={call}>
              <Phone aria-hidden />
              Appeler {a.contact.name.split(' ')[0]}
            </a>
          </Button>
        )}
        {a.mode === 'sur_site' && a.address.commune && (
          <Button asChild variant="outline" size="lg">
            <a href={mapsLink(a)} target="_blank" rel="noreferrer">
              <Navigation aria-hidden />
              Itinéraire
            </a>
          </Button>
        )}
      </div>

      {actions.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map((action, i) => (
            <Button
              key={action.status}
              size="lg"
              variant={i === 0 ? 'secondary' : 'outline'}
              className="h-14 text-body"
              loading={status.isPending && status.variables === action.status}
              onClick={() => status.mutate(action.status)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
      {status.isError && <Alert variant="danger">{status.error.message}</Alert>}

      <Card className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-h4">
          <MapPin className="size-5 text-ink-muted" aria-hidden />
          Intervention
        </h2>
        <AppointmentInfo appointment={a} />
      </Card>

      {editable && (
        <>
          <Card className="flex flex-col gap-4">
            <h2 className="text-h4">Rapport</h2>
            <ReportForm key={a.report?.status ?? 'new'} appointment={a} onSaved={onSaved} />
          </Card>
          <Card className="flex flex-col gap-4">
            <h2 className="text-h4">Photos</h2>
            {a.report ? (
              <Photos appointment={a} onSaved={onSaved} />
            ) : (
              <p className="text-body-sm text-ink-muted">
                Enregistrez d’abord le rapport pour ajouter des photos.
              </p>
            )}
          </Card>
          {a.status === 'terminee' && a.report?.workDone && (
            <SignatureStep appointment={a} onSaved={onSaved} />
          )}
          {a.status === 'terminee' && !a.report?.workDone && (
            <Alert variant="info">
              Décrivez les travaux effectués pour pouvoir faire signer le client.
            </Alert>
          )}
        </>
      )}

      {a.report?.status === 'signe' && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-h4">Rapport signé</h2>
            <Button
              variant="outline"
              onClick={() =>
                openProtectedFile(`/appointments/${a.id}/report/pdf`).catch((err: Error) =>
                  toast('Rapport indisponible', { description: err.message, variant: 'error' }),
                )
              }
            >
              <FileDown aria-hidden />
              PDF
            </Button>
          </div>
          <ReportSummary appointment={a} />
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-h4">Suivi</h2>
        <AppointmentTimeline status={a.status} history={a.statusHistory} />
      </Card>
    </>
  );
}
