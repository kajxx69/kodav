import { zodResolver } from '@hookform/resolvers/zod';
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  INTERVENTION_MODE_LABELS,
  availabilitySettingsSchema,
  formatCiPhone,
  type AdminAppointmentDto,
  type AvailabilitySettings,
  type AvailabilitySettingsInput,
} from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarX, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
} from 'react-hook-form';
import { useSearchParams } from 'react-router';
import type { z } from 'zod';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  SelectField,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextField,
  toast,
} from '~/components/ui';
import { AppointmentStatusBadge } from '~/features/appointments/AppointmentView';
import { apiRequest } from '~/lib/api';
import { cn } from '~/lib/cn';
import { applyServerErrors } from '~/lib/forms';
import { useStaffLive } from '~/lib/realtime';

const TZ = 'Africa/Abidjan';
const dayLabel = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});
const hour = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
type Technician = { id: string; firstName: string; lastName: string; phone: string };
const KEY = ['private', 'admin', 'appointments'];

function AppointmentRow({ a, technicians }: { a: AdminAppointmentDto; technicians: Technician[] }) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest<AdminAppointmentDto>(`/admin/appointments/${a.id}`, {
        method: 'PATCH',
        json: body,
      }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError(err) {
      toast('Modification impossible', { description: err.message, variant: 'error' });
    },
  });
  const closed = ['terminee', 'validee', 'annulee'].includes(a.status);
  return (
    <li className="grid gap-3 p-4 md:grid-cols-[5rem_minmax(0,1fr)_14rem_auto] md:items-center">
      <span className="text-label text-ink tabular-nums">
        {hour.format(new Date(a.start))}
        <span className="block text-caption text-ink-muted">{hour.format(new Date(a.end))}</span>
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-label text-ink">{a.contact.name}</span>
          <AppointmentStatusBadge status={a.status} />
        </span>
        <span className="text-body-sm text-ink-muted">
          {a.reference} · {INTERVENTION_MODE_LABELS[a.mode]}
          {a.address.commune ? ` · ${a.address.commune}` : ''} · {formatCiPhone(a.contact.phone)}
        </span>
        <span className="line-clamp-2 text-body-sm text-ink">
          {a.service?.name ?? a.description}
        </span>
      </span>
      <div className="flex flex-col gap-2">
        <SelectField
          label="Technicien"
          placeholder="À affecter"
          disabled={closed || update.isPending}
          options={technicians.map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))}
          value={a.technician?.id ?? ''}
          onChange={(e) => update.mutate({ technician: e.target.value || null })}
        />
        {!closed && (
          <TextField
            label="Déplacer au"
            type="datetime-local"
            step={900}
            defaultValue={a.start.slice(0, 16)}
            onBlur={(e) => {
              // Abidjan est en UTC+0 : la saisie locale vaut l'heure UTC.
              const value = e.target.value;
              if (value && value !== a.start.slice(0, 16))
                update.mutate({ start: `${value}:00.000Z` });
            }}
          />
        )}
      </div>
      {!closed ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={update.isPending}
          onClick={() => {
            if (
              window.confirm(
                `Annuler l’intervention ${a.reference} ? Le client est prévenu par email.`,
              )
            ) {
              update.mutate({ status: 'annulee' });
            }
          }}
        >
          Annuler
        </Button>
      ) : (
        <span />
      )}
    </li>
  );
}

function Interventions() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const status = params.get('statut') ?? '';
  const query = useQuery({
    queryKey: [...KEY, status],
    queryFn: () =>
      apiRequest<AdminAppointmentDto[]>(`/admin/appointments${status ? `?status=${status}` : ''}`),
  });
  const technicians = useQuery({
    queryKey: ['private', 'admin', 'technicians'],
    queryFn: () => apiRequest<Technician[]>('/admin/technicians'),
  });
  useStaffLive(() => void queryClient.invalidateQueries({ queryKey: KEY }));

  const groups = new Map<string, AdminAppointmentDto[]>();
  for (const a of query.data ?? []) {
    const label = dayLabel.format(new Date(a.start));
    groups.set(label, [...(groups.get(label) ?? []), a]);
  }

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label="Statut"
        placeholder="Tous"
        containerClassName="sm:w-60"
        options={APPOINTMENT_STATUSES.map((s) => ({
          value: s,
          label: APPOINTMENT_STATUS_LABELS[s],
        }))}
        value={status}
        onChange={(e) =>
          setParams(e.target.value ? { statut: e.target.value } : {}, { replace: true })
        }
      />
      {technicians.data?.length === 0 && (
        <Alert variant="warning">
          Aucun compte technicien actif : créez-en un pour pouvoir affecter les interventions.
        </Alert>
      )}
      {query.isPending ? (
        <Skeleton className="h-64" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : groups.size === 0 ? (
        <EmptyState icon={CalendarX} title="Aucune intervention sur les 14 prochains jours" />
      ) : (
        [...groups].map(([label, items]) => (
          <Card key={label} className="p-0">
            <h2 className="px-4 pt-4 text-h4 first-letter:uppercase">{label}</h2>
            <ul className="divide-y divide-line">
              {items.map((a) => (
                <AppointmentRow key={a.id} a={a} technicians={technicians.data ?? []} />
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}

type FormOutput = z.output<typeof availabilitySettingsSchema>;

function DayRanges({
  index,
  control,
  register,
}: {
  index: number;
  control: Control<AvailabilitySettingsInput, unknown, FormOutput>;
  register: UseFormRegister<AvailabilitySettingsInput>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `weekly.${index}.ranges` });
  const open = useWatch({ control, name: `weekly.${index}.open` });
  return (
    <div className="grid gap-3 border-t border-line py-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <Checkbox label={DAYS[index]!} {...register(`weekly.${index}.open`)} />
      {open ? (
        <div className="flex flex-col gap-2">
          {fields.map((f, j) => (
            <div key={f.id} className="flex items-end gap-2">
              <TextField
                label="De"
                type="time"
                containerClassName="w-32"
                {...register(`weekly.${index}.ranges.${j}.start`)}
              />
              <TextField
                label="À"
                type="time"
                containerClassName="w-32"
                {...register(`weekly.${index}.ranges.${j}.end`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Retirer la plage"
                onClick={() => remove(j)}
              >
                <Trash2 className="size-5" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => append({ start: '08:00', end: '12:00' })}
          >
            <Plus aria-hidden />
            Ajouter une plage
          </Button>
        </div>
      ) : (
        <p className="text-body-sm text-ink-muted">Fermé</p>
      )}
    </div>
  );
}

function AvailabilityForm({ settings }: { settings: AvailabilitySettings }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<AvailabilitySettingsInput, unknown, FormOutput>({
    resolver: zodResolver(availabilitySettingsSchema),
    defaultValues: settings,
  });
  const closed = useFieldArray({ control, name: 'closedDates' });
  const save = useMutation({
    mutationFn: (v: FormOutput) =>
      apiRequest<AvailabilitySettings>('/admin/availability', { method: 'PUT', json: v }),
    onSuccess(saved) {
      reset(saved);
      queryClient.setQueryData(['private', 'admin', 'availability'], saved);
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
      toast('Disponibilités enregistrées', { variant: 'success' });
    },
    onError(err) {
      setFormError(applyServerErrors(err, setError, []));
    },
  });
  const number = (
    name:
      | 'slotDuration'
      | 'bufferMinutes'
      | 'capacityPerSlot'
      | 'technicianCount'
      | 'minNoticeHours'
      | 'maxAdvanceDays'
      | 'cancelCutoffHours',
    label: string,
    help?: string,
  ) => (
    <TextField
      label={label}
      type="number"
      inputMode="numeric"
      min={0}
      help={help}
      error={errors[name]?.message}
      {...register(name)}
    />
  );

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        save.mutate(v);
      })}
      className="flex flex-col gap-6"
    >
      {formError && <Alert variant="danger">{formError}</Alert>}
      <Card className="flex flex-col gap-2">
        <h2 className="text-h4">Horaires d’intervention</h2>
        {settings.weekly.map((_, i) => (
          <DayRanges key={i} index={i} control={control} register={register} />
        ))}
      </Card>
      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <h2 className="text-h4 sm:col-span-2 lg:col-span-3">Créneaux</h2>
        {number('slotDuration', 'Durée d’un créneau (min)')}
        {number('bufferMinutes', 'Battement entre créneaux (min)', 'Temps de trajet, imprévus.')}
        {number('capacityPerSlot', 'Interventions par créneau')}
        {number(
          'technicianCount',
          'Techniciens disponibles',
          'La capacité réelle est le plus petit des deux nombres.',
        )}
        {number('minNoticeHours', 'Délai de prévenance (h)')}
        {number('maxAdvanceDays', 'Réservation jusqu’à (jours)')}
        {number('cancelCutoffHours', 'Report ou annulation jusqu’à (h avant)')}
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-h4">Jours fermés</h2>
        {closed.fields.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-end gap-2">
            <TextField
              label="Date"
              type="date"
              containerClassName="w-44"
              error={errors.closedDates?.[i]?.date?.message}
              {...register(`closedDates.${i}.date`)}
            />
            <TextField
              label="Motif"
              containerClassName="flex-1"
              {...register(`closedDates.${i}.reason`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Retirer la date"
              onClick={() => closed.remove(i)}
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
          onClick={() => closed.append({ date: '', reason: '' })}
        >
          <Plus aria-hidden />
          Ajouter un jour fermé
        </Button>
      </Card>
      <Button
        type="submit"
        variant="secondary"
        className="self-end"
        disabled={!isDirty}
        loading={save.isPending}
      >
        Enregistrer
      </Button>
    </form>
  );
}

const DAY_MS = 86_400_000;
const weekday = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: TZ,
});

function mondayOf(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

/**
 * Semaine : une ligne par technicien (et « À affecter »), une colonne par jour. Glisser une
 * intervention vers une autre case la déplace au même horaire et/ou la réaffecte.
 */
function WeekBoard() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS));
  const from = days[0]!.toISOString().slice(0, 10);
  const to = days[6]!.toISOString().slice(0, 10);
  const query = useQuery({
    queryKey: [...KEY, 'week', from],
    queryFn: () =>
      apiRequest<AdminAppointmentDto[]>(`/admin/appointments?from=${from}&to=${to}&limit=200`),
  });
  const technicians = useQuery({
    queryKey: ['private', 'admin', 'technicians'],
    queryFn: () => apiRequest<Technician[]>('/admin/technicians'),
  });
  useStaffLive(() => void queryClient.invalidateQueries({ queryKey: KEY }));
  const move = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiRequest(`/admin/appointments/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      toast('Intervention déplacée', {
        description: 'Le client et le technicien sont prévenus.',
        variant: 'success',
      });
    },
    onError: (err) =>
      toast('Déplacement impossible', { description: err.message, variant: 'error' }),
  });

  const rows: { id: string | null; name: string }[] = [
    { id: null, name: 'À affecter' },
    ...(technicians.data ?? []).map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}` })),
  ];
  const items = (query.data ?? []).filter((a) => a.status !== 'annulee');
  const cell = (tech: string | null, day: Date) =>
    items.filter(
      (a) =>
        (a.technician?.id ?? null) === tech &&
        a.start.slice(0, 10) === day.toISOString().slice(0, 10),
    );

  const drop = (tech: string | null, day: Date) => {
    const a = items.find((x) => x.id === dragging);
    setDragging(null);
    setOver(null);
    if (!a) return;
    const body: Record<string, unknown> = {};
    const date = day.toISOString().slice(0, 10);
    if (a.start.slice(0, 10) !== date) body.start = `${date}${a.start.slice(10)}`;
    if ((a.technician?.id ?? null) !== tech) body.technician = tech;
    if (Object.keys(body).length) move.mutate({ id: a.id, body });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY_MS))}
        >
          Semaine précédente
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setWeekStart(mondayOf(new Date()))}>
          Cette semaine
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY_MS))}
        >
          Semaine suivante
        </Button>
        <p className="text-body-sm text-ink-muted">
          Faites glisser une intervention pour la déplacer ou la réaffecter. Au clavier : vue Liste.
        </p>
      </div>
      {query.isPending || technicians.isPending ? (
        <Skeleton className="h-80" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
          <table className="w-full min-w-[56rem] table-fixed border-collapse text-body-sm">
            <caption className="sr-only">Planning de la semaine par technicien</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-36 border-b border-line p-2 text-left text-label text-ink-muted"
                >
                  Technicien
                </th>
                {days.map((d) => (
                  <th
                    key={d.toISOString()}
                    scope="col"
                    className="border-b border-l border-line p-2 text-left text-label text-ink-muted first-letter:uppercase"
                  >
                    {weekday.format(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id ?? 'none'}>
                  <th
                    scope="row"
                    className="border-t border-line p-2 text-left align-top text-label text-ink"
                  >
                    {r.name}
                  </th>
                  {days.map((d) => {
                    const key = `${r.id ?? 'none'}-${d.toISOString()}`;
                    return (
                      <td
                        key={key}
                        onDragOver={(e) => {
                          if (!dragging) return;
                          e.preventDefault();
                          setOver(key);
                        }}
                        onDragLeave={() => setOver((o) => (o === key ? null : o))}
                        onDrop={(e) => {
                          e.preventDefault();
                          drop(r.id, d);
                        }}
                        className={cn(
                          'h-24 border-t border-l border-line p-1.5 align-top transition-colors',
                          over === key && 'bg-info-soft',
                        )}
                      >
                        <ul className="flex flex-col gap-1.5">
                          {cell(r.id, d).map((a) => {
                            const locked = ['en_cours', 'terminee', 'validee'].includes(a.status);
                            return (
                              <li
                                key={a.id}
                                draggable={!locked}
                                onDragStart={(e) => {
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.dataTransfer.setData('text/plain', a.id);
                                  setDragging(a.id);
                                }}
                                onDragEnd={() => {
                                  setDragging(null);
                                  setOver(null);
                                }}
                                title={`${a.reference} · ${a.contact.name}${a.address.commune ? ` · ${a.address.commune}` : ''}`}
                                className={cn(
                                  'rounded-md border border-line bg-surface p-1.5 text-caption shadow-sm',
                                  !locked && 'cursor-grab active:cursor-grabbing',
                                  dragging === a.id && 'opacity-50',
                                  a.status === 'demande_recue' && 'border-l-2 border-l-warning',
                                )}
                              >
                                <span className="block text-label text-ink tabular-nums">
                                  {hour.format(new Date(a.start))}
                                </span>
                                <span className="block truncate text-ink">{a.contact.name}</span>
                                <span className="block truncate text-ink-muted">
                                  {a.address.commune ?? INTERVENTION_MODE_LABELS[a.mode]}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminPlanning() {
  const availability = useQuery({
    queryKey: ['private', 'admin', 'availability'],
    queryFn: () => apiRequest<AvailabilitySettings>('/admin/availability'),
  });
  return (
    <>
      <SpaceHeader
        title="Planning"
        lead="Interventions des 14 prochains jours, affectation des techniciens et créneaux proposés aux clients."
      />
      <Tabs defaultValue="semaine">
        <TabsList aria-label="Planning">
          <TabsTrigger value="semaine">Semaine</TabsTrigger>
          <TabsTrigger value="interventions">Liste</TabsTrigger>
          <TabsTrigger value="disponibilites">Disponibilités</TabsTrigger>
        </TabsList>
        <TabsContent value="semaine">
          <WeekBoard />
        </TabsContent>
        <TabsContent value="interventions">
          <Interventions />
        </TabsContent>
        <TabsContent value="disponibilites">
          {availability.isPending ? (
            <Skeleton className="h-96" />
          ) : availability.isError ? (
            <ErrorState
              message={availability.error.message}
              onRetry={() => void availability.refetch()}
            />
          ) : (
            <AvailabilityForm settings={availability.data} />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
