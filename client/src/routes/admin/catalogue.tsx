import { zodResolver } from '@hookform/resolvers/zod';
import {
  ABIDJAN_COMMUNES,
  INTERVENTION_MODES,
  INTERVENTION_MODE_LABELS,
  PRICING_MODES,
  adminServiceUpdateSchema,
  type AdminService,
  type AdminServiceUpdateInput,
  type Estimate,
  type InterventionMode,
} from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorState,
  Modal,
  SelectField,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextField,
  toast,
} from '~/components/ui';
import { apiRequest } from '~/lib/api';
import {
  CategoriesPanel,
  PlansPanel,
  PricingRulesPanel,
  type CategoryRow,
} from '~/features/catalog/CatalogSettings';
import { ServiceEditor } from '~/features/catalog/ServiceEditor';
import { applyServerErrors } from '~/lib/forms';
import { priceLabel, rangeLabel } from '~/lib/format';
import { queries } from '~/lib/queries';

const SERVICES_KEY = ['private', 'admin', 'services'];
const MODE_LABELS = { forfait: 'Forfait', par_unite: 'Par unité', sur_devis: 'Sur devis' } as const;
type FormOutput = z.output<typeof adminServiceUpdateSchema>;

function ServiceForm({ service, onDone }: { service: AdminService; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdminServiceUpdateInput, unknown, FormOutput>({
    resolver: zodResolver(adminServiceUpdateSchema),
    defaultValues: {
      pricingMode: service.pricingMode,
      unitLabel: service.unitLabel ?? '',
      priceMin: service.priceMin,
      priceMax: service.priceMax,
      isActive: service.isActive,
      featured: service.featured,
    },
  });
  const mode = useWatch({ control, name: 'pricingMode' });
  const mutation = useMutation({
    mutationFn: (values: FormOutput) =>
      apiRequest<AdminService>(`/admin/services/${service.id}`, { method: 'PATCH', json: values }),
    onSuccess(updated) {
      queryClient.setQueryData<AdminService[]>(SERVICES_KEY, (all) =>
        all?.map((s) => (s.id === updated.id ? updated : s)),
      );
      // Le site public et les compteurs de l'admin reflètent le nouveau tarif.
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'overview'] });
      toast('Tarif enregistré', { variant: 'success' });
      onDone();
    },
    onError(error) {
      setFormError(applyServerErrors(error, setError, ['priceMin', 'priceMax', 'unitLabel']));
    },
  });
  const amount = { setValueAs: (v: string) => (v === '' ? undefined : Number(v)) };

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        mutation.mutate(values);
      })}
      className="grid gap-4 sm:grid-cols-2"
    >
      {formError && (
        <Alert variant="danger" className="sm:col-span-2">
          {formError}
        </Alert>
      )}
      <SelectField
        label="Tarification"
        options={PRICING_MODES.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
        {...register('pricingMode')}
      />
      {mode === 'par_unite' && (
        <TextField
          label="Unité"
          placeholder="poste, heure, page…"
          error={errors.unitLabel?.message}
          {...register('unitLabel')}
        />
      )}
      {mode !== 'sur_devis' && (
        <>
          <TextField
            label={mode === 'par_unite' ? 'Prix minimum par unité (FCFA)' : 'Prix minimum (FCFA)'}
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            error={errors.priceMin?.message}
            {...register('priceMin', amount)}
          />
          <TextField
            label={mode === 'par_unite' ? 'Prix maximum par unité (FCFA)' : 'Prix maximum (FCFA)'}
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            error={errors.priceMax?.message}
            {...register('priceMax', amount)}
          />
        </>
      )}
      <Checkbox label="Service visible sur le site" {...register('isActive')} />
      <Checkbox label="Mis en avant sur l’accueil" {...register('featured')} />
      {service.isPlaceholderPrice && (
        <p className="text-body-sm text-ink-muted sm:col-span-2">
          À l’enregistrement, ce tarif ne sera plus signalé comme tarif d’exemple.
        </p>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" variant="secondary" loading={mutation.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function PricingPreview({ services }: { services: AdminService[] }) {
  const rules = useQuery(queries.pricingRules());
  const priced = services.filter((s) => s.isActive && s.categoryActive);
  const [serviceId, setServiceId] = useState(priced[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState('standard');
  const [mode, setMode] = useState<InterventionMode>('sur_site');
  const [commune, setCommune] = useState('Cocody');
  const preview = useMutation({
    mutationFn: () =>
      apiRequest<Estimate>('/admin/pricing/preview', {
        method: 'POST',
        json: {
          items: [{ serviceId, quantity }],
          urgency,
          mode,
          commune: mode === 'sur_site' ? commune : undefined,
        },
      }),
  });
  const result = preview.data;
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h4">Aperçu du calcul</h2>
        <p className="text-body-sm text-ink-muted">
          Le même moteur que le configurateur du site, avec les tarifs enregistrés.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SelectField
          label="Service"
          containerClassName="lg:col-span-2"
          options={priced.map((s) => ({ value: s.id, label: s.name }))}
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
        />
        <TextField
          label="Quantité"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
        />
        <SelectField
          label="Délai"
          options={(rules.data?.urgency ?? []).map((u) => ({ value: u.key, label: u.label }))}
          value={urgency}
          onChange={(e) => setUrgency(e.target.value)}
        />
        <SelectField
          label="Mode"
          options={INTERVENTION_MODES.map((m) => ({
            value: m,
            label: INTERVENTION_MODE_LABELS[m],
          }))}
          value={mode}
          onChange={(e) => setMode(e.target.value as InterventionMode)}
        />
        {mode === 'sur_site' && (
          <SelectField
            label="Commune"
            options={[...ABIDJAN_COMMUNES, 'Hors Abidjan'].map((c) => ({ value: c, label: c }))}
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
          />
        )}
      </div>
      <Button
        variant="secondary"
        className="self-start"
        disabled={!serviceId}
        loading={preview.isPending}
        onClick={() => preview.mutate()}
      >
        Calculer
      </Button>
      {preview.isError && <Alert variant="danger">{preview.error.message}</Alert>}
      {result && (
        <dl className="grid gap-2 rounded-md bg-surface-sunken p-4 text-body-sm sm:grid-cols-2">
          <dt className="text-ink-muted">Ligne</dt>
          <dd className="tabular-nums">
            {result.lines[0]?.onQuote ? 'Sur devis' : rangeLabel(result.subtotal)}
          </dd>
          <dt className="text-ink-muted">Remise volume</dt>
          <dd className="tabular-nums">- {rangeLabel(result.volumeDiscount)}</dd>
          <dt className="text-ink-muted">Urgence ({result.urgency.percent} %)</dt>
          <dd className="tabular-nums">{rangeLabel(result.urgency.amount)}</dd>
          <dt className="text-ink-muted">Déplacement</dt>
          <dd>
            {result.travel.status === 'included'
              ? rangeLabel({ min: result.travel.fee, max: result.travel.fee })
              : result.travel.status === 'on_quote'
                ? 'Sur devis'
                : '—'}
          </dd>
          <dt className="text-label">Total</dt>
          <dd className="text-label tabular-nums">{rangeLabel(result.total)}</dd>
        </dl>
      )}
    </Card>
  );
}

export default function AdminCatalogue() {
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [full, setFull] = useState<AdminService | 'new' | null>(null);
  const categories = useQuery({
    queryKey: ['private', 'admin', 'categories'],
    queryFn: () => apiRequest<CategoryRow[]>('/admin/categories'),
  });
  const query = useQuery({
    queryKey: SERVICES_KEY,
    queryFn: () => apiRequest<AdminService[]>('/admin/services'),
  });
  const placeholders = query.data?.filter((s) => s.isPlaceholderPrice).length ?? 0;
  const groups = new Map<string, AdminService[]>();
  for (const s of query.data ?? []) {
    groups.set(s.category.name, [...(groups.get(s.category.name) ?? []), s]);
  }

  return (
    <>
      <SpaceHeader
        title="Catalogue"
        lead="Pôles, services et options, règles tarifaires et formules de maintenance. Le site et le configurateur de devis se mettent à jour aussitôt."
      />
      <Tabs defaultValue="services">
        <TabsList aria-label="Catalogue">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="poles">Pôles</TabsTrigger>
          <TabsTrigger value="regles">Règles tarifaires</TabsTrigger>
          <TabsTrigger value="formules">Formules</TabsTrigger>
        </TabsList>
        <TabsContent value="services" className="flex flex-col gap-6">
          <Button
            variant="secondary"
            className="self-start"
            disabled={!categories.data}
            onClick={() => setFull('new')}
          >
            <Plus aria-hidden />
            Nouveau service
          </Button>
          {placeholders > 0 && (
            <Alert variant="warning" title={`${placeholders} services avec un tarif d’exemple`}>
              Remplacez-les par vos tarifs réels : le badge « Exemple » disparaît à
              l’enregistrement.
            </Alert>
          )}
          {query.isPending ? (
            <Skeleton className="h-96" />
          ) : query.isError ? (
            <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
          ) : (
            <>
              {[...groups].map(([pole, services]) => (
                <Card key={pole} className="flex flex-col gap-2 p-0">
                  <h2 className="px-5 pt-5 text-h4">{pole}</h2>
                  <ul className="divide-y divide-line">
                    {services.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                      >
                        <span className="flex flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2 text-label text-ink">
                            {s.name}
                            {s.isPlaceholderPrice && <Badge variant="warning">Exemple</Badge>}
                            {!s.isActive && <Badge>Masqué</Badge>}
                            {s.featured && <Badge variant="info">Mis en avant</Badge>}
                          </span>
                          <span className="text-body-sm text-ink-muted">
                            {MODE_LABELS[s.pricingMode]} ·{' '}
                            {s.pricingMode === 'sur_devis'
                              ? 'Sur devis'
                              : `${rangeLabel({ min: s.priceMin ?? 0, max: s.priceMax ?? 0 })}${s.pricingMode === 'par_unite' ? ` / ${s.unitLabel}` : ''}`}
                          </span>
                        </span>
                        <span className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Modifier le tarif de ${s.name}`}
                            onClick={() => setEditing(s)}
                          >
                            <Pencil aria-hidden />
                            Tarif
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Modifier le service ${s.name} en détail`}
                            disabled={!categories.data}
                            onClick={() => setFull(s)}
                          >
                            Tout modifier
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
              <PricingPreview services={query.data} />
            </>
          )}
        </TabsContent>
        <TabsContent value="poles">
          {categories.data ? (
            <CategoriesPanel categories={categories.data} />
          ) : (
            <Skeleton className="h-48" />
          )}
        </TabsContent>
        <TabsContent value="regles">
          <PricingRulesPanel />
        </TabsContent>
        <TabsContent value="formules">
          <PlansPanel />
        </TabsContent>
      </Tabs>
      <Modal
        open={full !== null}
        onOpenChange={(open) => !open && setFull(null)}
        title={full === 'new' ? 'Nouveau service' : full ? full.name : 'Service'}
      >
        {full !== null && categories.data && (
          <ServiceEditor
            service={full === 'new' ? null : full}
            categories={categories.data}
            onDone={() => setFull(null)}
          />
        )}
      </Modal>
      <Modal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? editing.name : 'Service'}
        description={editing ? `Tarif actuel : ${priceLabel(editing)}` : undefined}
      >
        {editing && <ServiceForm service={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
