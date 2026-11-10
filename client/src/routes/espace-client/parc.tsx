import { zodResolver } from '@hookform/resolvers/zod';
import {
  ASSET_STATUSES,
  ASSET_STATUS_LABELS,
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  assetInputSchema,
  type AssetDto,
  type AssetInput,
  type AssetType,
} from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AppWindow,
  HardDrive,
  KeyRound,
  Laptop,
  Monitor,
  Network,
  Package,
  Pencil,
  Plus,
  Printer,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Modal,
  SelectField,
  Skeleton,
  TextArea,
  TextField,
  toast,
} from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { formatDate } from '~/lib/format';
import { applyServerErrors } from '~/lib/forms';

const KEY = ['private', 'assets'];
type Output = z.output<typeof assetInputSchema>;

const ICONS: Record<AssetType, LucideIcon> = {
  poste: Monitor,
  portable: Laptop,
  serveur: HardDrive,
  imprimante: Printer,
  reseau: Network,
  licence: AppWindow,
  autre: Package,
};

/** Jours avant expiration (négatif : expirée). */
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

function LicenseBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;
  const d = daysLeft(expiresAt);
  if (d < 0) return <Badge variant="danger">Expirée</Badge>;
  if (d <= 30) return <Badge variant="warning">Expire dans {d} j</Badge>;
  return <Badge variant="success">Valide jusqu’au {formatDate(expiresAt)}</Badge>;
}

function AssetForm({ asset, onDone }: { asset: AssetDto | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AssetInput, unknown, Output>({
    resolver: zodResolver(assetInputSchema),
    defaultValues: asset
      ? {
          ...asset,
          purchaseDate: asset.purchaseDate ?? '',
          warrantyUntil: asset.warrantyUntil ?? '',
          license: asset.license
            ? {
                product: asset.license.product,
                seats: asset.license.seats,
                expiresAt: asset.license.expiresAt ?? '',
                key: '',
                storeKey: false,
              }
            : { product: '', seats: 1, expiresAt: '', key: '', storeKey: false },
        }
      : {
          type: 'poste',
          name: '',
          status: 'actif',
          license: { product: '', seats: 1, expiresAt: '', key: '', storeKey: false },
        },
  });
  const type = useWatch({ control, name: 'type' });
  const save = useMutation({
    mutationFn: (values: Output) =>
      apiRequest<AssetDto>(asset ? `/assets/${asset.id}` : '/assets', {
        method: asset ? 'PUT' : 'POST',
        json: values,
      }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: KEY });
      toast(asset ? 'Équipement mis à jour' : 'Équipement ajouté', { variant: 'success' });
      onDone();
    },
    onError: (err) =>
      setFormError(
        applyServerErrors(err, setError, [
          'name',
          'type',
          'purchaseDate',
          'warrantyUntil',
          'license.product',
          'license.expiresAt',
          'license.key',
        ]),
      ),
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        save.mutate(v);
      })}
      className="grid gap-4 sm:grid-cols-2"
    >
      {formError && (
        <Alert variant="danger" className="sm:col-span-2">
          {formError}
        </Alert>
      )}
      <SelectField
        label="Type"
        options={ASSET_TYPES.map((t) => ({ value: t, label: ASSET_TYPE_LABELS[t] }))}
        {...register('type')}
      />
      <TextField
        label="Nom"
        required
        placeholder={type === 'licence' ? 'Ex. : Office du secrétariat' : 'Ex. : PC accueil'}
        error={errors.name?.message}
        {...register('name')}
      />
      {type === 'licence' ? (
        <>
          <TextField
            label="Logiciel"
            required
            placeholder="Ex. : Microsoft 365"
            error={errors.license?.product?.message}
            {...register('license.product')}
          />
          <TextField
            label="Nombre de postes"
            type="number"
            min={1}
            {...register('license.seats')}
          />
          <TextField
            label="Date d’expiration"
            type="date"
            required
            error={errors.license?.expiresAt?.message}
            {...register('license.expiresAt')}
          />
          <TextField
            label={
              asset?.license?.keyLast5
                ? `Clé (actuelle : …${asset.license.keyLast5})`
                : 'Clé de licence (facultatif)'
            }
            autoComplete="off"
            help="Seuls les 5 derniers caractères sont conservés, sauf si vous nous la confiez."
            error={errors.license?.key?.message}
            {...register('license.key')}
          />
          <Checkbox
            className="sm:col-span-2"
            label="Confier la clé complète à KODAV, chiffrée (utile pour une réinstallation)"
            {...register('license.storeKey')}
          />
          {asset?.license?.keyStored && (
            <p className="text-caption text-ink-muted sm:col-span-2">
              Une clé chiffrée est déjà conservée pour cette licence.
            </p>
          )}
        </>
      ) : (
        <>
          <TextField label="Marque" {...register('brand')} />
          <TextField label="Modèle" {...register('model')} />
          <TextField label="N° de série" {...register('serialNumber')} />
          <TextField
            label="Emplacement"
            placeholder="Ex. : salle 2, bureau direction"
            {...register('location')}
          />
          <TextField
            label="Utilisateur"
            placeholder="Personne ou service"
            {...register('assignedTo')}
          />
          <TextField
            label="Date d’achat"
            type="date"
            error={errors.purchaseDate?.message}
            {...register('purchaseDate')}
          />
          <TextField
            label="Garantie jusqu’au"
            type="date"
            error={errors.warrantyUntil?.message}
            {...register('warrantyUntil')}
          />
        </>
      )}
      <SelectField
        label="État"
        options={ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABELS[s] }))}
        {...register('status')}
      />
      <TextArea label="Notes" containerClassName="sm:col-span-2" {...register('notes')} />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" variant="secondary" loading={save.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function AssetRow({ asset, onEdit }: { asset: AssetDto; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => apiRequest(`/assets/${asset.id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
  const Icon = ICONS[asset.type];
  const details =
    asset.type === 'licence'
      ? [
          asset.license?.product,
          asset.license && `${asset.license.seats} poste${asset.license.seats > 1 ? 's' : ''}`,
          asset.license?.keyLast5 && `clé …${asset.license.keyLast5}`,
        ]
      : [
          [asset.brand, asset.model].filter(Boolean).join(' '),
          asset.serialNumber && `N° ${asset.serialNumber}`,
          asset.location,
          asset.assignedTo,
        ];
  return (
    <li className="flex flex-wrap items-center gap-4 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-sunken text-slate dark:text-link">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-label text-ink">{asset.name}</span>
          {asset.status !== 'actif' && (
            <Badge variant={asset.status === 'en_panne' ? 'danger' : 'neutral'}>
              {ASSET_STATUS_LABELS[asset.status]}
            </Badge>
          )}
          {asset.type === 'licence' && (
            <LicenseBadge expiresAt={asset.license?.expiresAt ?? null} />
          )}
          {asset.license?.keyStored && (
            <Badge variant="info">
              <KeyRound aria-hidden />
              Clé confiée
            </Badge>
          )}
          {asset.openTickets > 0 && (
            <Badge variant="gold">
              {asset.openTickets} ticket{asset.openTickets > 1 ? 's' : ''} en cours
            </Badge>
          )}
        </span>
        <span className="text-body-sm text-ink-muted">
          {details.filter(Boolean).join(' · ') || '—'}
        </span>
        {asset.warrantyUntil && asset.type !== 'licence' && (
          <span className="text-caption text-ink-muted">
            Garantie jusqu’au {formatDate(asset.warrantyUntil)}
          </span>
        )}
      </span>
      <span className="flex flex-wrap gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/espace-client/tickets/nouveau?equipement=${asset.id}`}>
            Signaler un problème
          </Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label={`Modifier ${asset.name}`} onClick={onEdit}>
          <Pencil className="size-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Supprimer ${asset.name}`}
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Supprimer « ${asset.name} » du parc ?`)) remove.mutate();
          }}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </span>
    </li>
  );
}

export default function ClientPark() {
  const query = useQuery({ queryKey: KEY, queryFn: () => apiRequest<AssetDto[]>('/assets') });
  const [editing, setEditing] = useState<AssetDto | 'new' | null>(null);
  const items = query.data ?? [];
  const expiring = items.filter(
    (a) =>
      a.type === 'licence' &&
      a.status !== 'retire' &&
      a.license?.expiresAt &&
      daysLeft(a.license.expiresAt) <= 30,
  );

  return (
    <>
      <SpaceHeader
        title="Mon parc informatique"
        lead="Postes, serveurs, imprimantes, équipements réseau et licences. Nous vous prévenons avant l’expiration d’une licence."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            Ajouter un équipement
          </Button>
        }
      />
      {expiring.length > 0 && (
        <Alert
          variant="warning"
          title={`${expiring.length} licence${expiring.length > 1 ? 's' : ''} à renouveler`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/devis?service=logiciels/microsoft-365-office-windows">
                Demander un renouvellement
              </Link>
            </Button>
          }
        >
          {expiring.map((a) => `${a.license!.product} (${a.name})`).join(', ')}
        </Alert>
      )}
      {query.isPending ? (
        <Skeleton className="h-64" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="Votre parc est vide"
          description="Recensez vos équipements et licences : vous pourrez les rattacher à vos demandes de support et suivre les échéances."
        />
      ) : (
        ASSET_TYPES.filter((t) => items.some((a) => a.type === t)).map((type) => (
          <Card key={type} className="p-0">
            <h2 className="flex items-center justify-between px-4 pt-4 text-h4">
              {ASSET_TYPE_LABELS[type]}
              <Badge>{items.filter((a) => a.type === type).length}</Badge>
            </h2>
            <ul className="divide-y divide-line">
              {items
                .filter((a) => a.type === type)
                .map((a) => (
                  <AssetRow key={a.id} asset={a} onEdit={() => setEditing(a)} />
                ))}
            </ul>
          </Card>
        ))
      )}
      <Modal
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? 'Ajouter un équipement' : 'Modifier l’équipement'}
      >
        {editing !== null && (
          <AssetForm
            key={editing === 'new' ? 'new' : editing.id}
            asset={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </>
  );
}
