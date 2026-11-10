import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TIMELINE,
  INTERVENTION_MODE_LABELS,
  formatCiPhone,
  type AppointmentDto,
  type AppointmentStatus,
} from '@kodav/shared';
import { useQuery } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';
import { useEffect } from 'react';
import { Badge, Skeleton, StatusTimeline } from '~/components/ui';
import { fetchProtectedBlobUrl } from '~/lib/api';
import { formatDateTime } from '~/lib/format';
import { formatSlot } from './SlotPicker';

const VARIANT: Record<
  AppointmentStatus,
  'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'gold'
> = {
  demande_recue: 'info',
  planifiee: 'info',
  en_route: 'gold',
  en_cours: 'gold',
  terminee: 'success',
  validee: 'success',
  annulee: 'danger',
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge variant={VARIANT[status]}>{APPOINTMENT_STATUS_LABELS[status]}</Badge>;
}

/** Suivi façon colis : Demande reçue → Planifiée → En route → En cours → Terminée → Validée. */
export function AppointmentTimeline({
  status,
  history,
  orientation,
}: {
  status: AppointmentStatus;
  history: { status: AppointmentStatus; at: string }[];
  orientation?: 'vertical' | 'horizontal';
}) {
  if (status === 'annulee') {
    const at = history.findLast((h) => h.status === 'annulee')?.at;
    return (
      <StatusTimeline
        steps={[
          {
            key: 'demande_recue',
            label: 'Demande reçue',
            date: history[0] && formatDateTime(history[0].at),
          },
          { key: 'annulee', label: 'Annulée', date: at && formatDateTime(at) },
        ]}
        current={1}
        orientation={orientation}
      />
    );
  }
  const steps = APPOINTMENT_TIMELINE.map((s) => {
    const entry = history.findLast((h) => h.status === s);
    return {
      key: s,
      label: APPOINTMENT_STATUS_LABELS[s],
      date: entry ? formatDateTime(entry.at) : undefined,
    };
  });
  return (
    <StatusTimeline
      steps={steps}
      current={Math.max(APPOINTMENT_TIMELINE.indexOf(status), 0)}
      orientation={orientation}
    />
  );
}

export function mapsLink(a: Pick<AppointmentDto, 'address'>) {
  const destination = [a.address.street, a.address.landmark, a.address.commune, 'Abidjan']
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function AppointmentInfo({
  appointment: a,
  showContact = true,
}: {
  appointment: AppointmentDto;
  showContact?: boolean;
}) {
  const rows: [string, string][] = [
    ['Date', formatSlot(a.start)],
    ['Mode', INTERVENTION_MODE_LABELS[a.mode]],
  ];
  if (a.service) rows.push(['Prestation', a.service.name]);
  if (a.quote) rows.push(['Devis', a.quote.reference]);
  if (a.address.commune) {
    rows.push(['Adresse', [a.address.street, a.address.commune].filter(Boolean).join(', ')]);
    if (a.address.landmark) rows.push(['Repère', a.address.landmark]);
  }
  if (showContact) {
    rows.push(['Contact', `${a.contact.name} · ${formatCiPhone(a.contact.phone)}`]);
  }
  rows.push([
    'Technicien',
    a.technician ? `${a.technician.firstName} ${a.technician.lastName}` : 'Affectation en cours',
  ]);
  return (
    <dl className="grid gap-3 text-body-sm sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-caption text-ink-muted">{label}</dt>
          <dd className="break-words text-ink first-letter:uppercase">{value}</dd>
        </div>
      ))}
      <div className="sm:col-span-2">
        <dt className="text-caption text-ink-muted">Demande</dt>
        <dd className="whitespace-pre-line text-ink">{a.description}</dd>
      </div>
    </dl>
  );
}

function ProtectedImage({ path, alt }: { path: string; alt: string }) {
  const query = useQuery({
    queryKey: ['private', 'blob', path],
    queryFn: () => fetchProtectedBlobUrl(path),
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
  useEffect(() => {
    const url = query.data;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [query.data]);
  if (query.isPending) return <Skeleton className="aspect-square w-full" />;
  if (query.isError) {
    return (
      <span className="grid aspect-square place-items-center rounded-md bg-surface-sunken text-ink-muted">
        <ImageOff className="size-6" aria-label="Image indisponible" />
      </span>
    );
  }
  return (
    <img src={query.data} alt={alt} className="aspect-square w-full rounded-md object-cover" />
  );
}

export function ReportPhotos({ appointment }: { appointment: AppointmentDto }) {
  if (!appointment.report?.photos.length) return null;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {appointment.report.photos.map((p, i) => (
        <li key={p.id}>
          <ProtectedImage
            path={`/appointments/${appointment.id}/report/photos/${p.id}`}
            alt={`Photo ${i + 1} de l’intervention`}
          />
        </li>
      ))}
    </ul>
  );
}

const minutes = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;

export function ReportSummary({ appointment }: { appointment: AppointmentDto }) {
  const r = appointment.report;
  if (!r) return null;
  return (
    <div className="flex flex-col gap-4 text-body-sm">
      <div>
        <p className="text-caption text-ink-muted">Travaux effectués</p>
        <p className="whitespace-pre-line text-ink">{r.workDone || '—'}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-caption text-ink-muted">Temps passé</p>
          <p className="text-ink">{minutes(r.timeSpentMinutes)}</p>
        </div>
        {r.materials.length > 0 && (
          <div>
            <p className="text-caption text-ink-muted">Matériel</p>
            <ul className="text-ink">
              {r.materials.map((m, i) => (
                <li key={i}>
                  {m.quantity} × {m.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <ReportPhotos appointment={appointment} />
      {r.signedAt && (
        <p className="text-ink-muted">
          Signé par {r.signerName} le {formatDateTime(r.signedAt)}.
        </p>
      )}
    </div>
  );
}
