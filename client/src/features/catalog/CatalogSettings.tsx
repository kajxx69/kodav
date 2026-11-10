import { zodResolver } from '@hookform/resolvers/zod';
import {
  ABIDJAN_COMMUNES,
  CLIENT_PROFILES,
  PROFILE_META,
  adminCategorySchema,
  adminPlanSchema,
  formatFcfa,
  pricingRulesInputSchema,
  type AdminCategoryInput,
  type AdminPlanInput,
  type MaintenancePlan,
  type PricingRulesInput,
} from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import type { z } from 'zod';
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
  TextArea,
  TextField,
  toast,
} from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { applyServerErrors } from '~/lib/forms';

// --- Pôles -----------------------------------------------------------------------------

export type CategoryRow = z.output<typeof adminCategorySchema> & { id: string };

function CategoryForm({ category, onDone }: { category: CategoryRow | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdminCategoryInput, unknown, z.output<typeof adminCategorySchema>>({
    resolver: zodResolver(adminCategorySchema),
    defaultValues: category ?? { slug: '', name: '', icon: 'package', isActive: true, order: 0 },
  });
  const save = useMutation({
    mutationFn: (v: z.output<typeof adminCategorySchema>) =>
      apiRequest(category ? `/admin/categories/${category.id}` : '/admin/categories', {
        method: category ? 'PUT' : 'POST',
        json: v,
      }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'categories'] });
      void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'services'] });
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
      toast('Pôle enregistré', { variant: 'success' });
      onDone();
    },
    onError: (err) => setFormError(applyServerErrors(err, setError, ['slug', 'name'])),
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
      <TextField label="Nom" required error={errors.name?.message} {...register('name')} />
      <TextField
        label="Adresse de la page"
        required
        help="/services/…"
        error={errors.slug?.message}
        {...register('slug')}
      />
      <TextField
        label="Icône (nom Lucide)"
        help="code, network, app-window, wrench…"
        {...register('icon')}
      />
      <TextField label="Ordre" type="number" {...register('order')} />
      <TextArea
        label="Accroche"
        containerClassName="sm:col-span-2"
        rows={2}
        {...register('shortDescription')}
      />
      <TextArea
        label="Description"
        containerClassName="sm:col-span-2"
        rows={4}
        {...register('description')}
      />
      <TextField label="Titre SEO" containerClassName="sm:col-span-2" {...register('seo.title')} />
      <TextArea
        label="Description SEO"
        containerClassName="sm:col-span-2"
        rows={2}
        {...register('seo.description')}
      />
      <Checkbox
        label="Visible sur le site (masqué : ses services aussi)"
        className="sm:col-span-2"
        {...register('isActive')}
      />
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

export function CategoriesPanel({ categories }: { categories: CategoryRow[] }) {
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <Button variant="secondary" className="self-start" onClick={() => setEditing('new')}>
        <Plus aria-hidden />
        Nouveau pôle
      </Button>
      <Card className="p-0">
        <ul className="divide-y divide-line">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 p-4">
              <span>
                <span className="flex items-center gap-2 text-label text-ink">
                  {c.name}
                  {!c.isActive && <Badge>Masqué</Badge>}
                </span>
                <span className="text-caption text-ink-muted">/services/{c.slug}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Modifier ${c.name}`}
                onClick={() => setEditing(c)}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <Modal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? 'Nouveau pôle' : 'Modifier le pôle'}
      >
        {editing !== null && (
          <CategoryForm
            category={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// --- Règles tarifaires ----------------------------------------------------------------------

type Rules = z.output<typeof pricingRulesInputSchema>;

function RulesForm({ rules }: { rules: Rules }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<PricingRulesInput, unknown, Rules>({
    resolver: zodResolver(pricingRulesInputSchema),
    defaultValues: rules,
  });
  const urgency = useFieldArray({ control, name: 'urgency' });
  const travel = useFieldArray({ control, name: 'travel' });
  const volume = useFieldArray({ control, name: 'volumeDiscount' });
  const save = useMutation({
    mutationFn: (v: Rules) => apiRequest<Rules>('/admin/pricing-rules', { method: 'PUT', json: v }),
    onSuccess(saved) {
      reset(saved);
      void queryClient.invalidateQueries({ queryKey: ['pricing'] });
      toast('Règles tarifaires enregistrées', { variant: 'success' });
    },
    onError: (err) => setFormError(err.message),
  });
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
      <Card className="flex flex-col gap-3">
        <h3 className="text-h4">Urgence</h3>
        <p className="text-body-sm text-ink-muted">
          Majoration appliquée au total selon le délai choisi. Le niveau de clé « standard » est
          obligatoire.
        </p>
        {errors.urgency?.root?.message && (
          <p className="text-body-sm text-danger">{errors.urgency.root.message}</p>
        )}
        {urgency.fields.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-end gap-2">
            <TextField label="Clé" containerClassName="w-28" {...register(`urgency.${i}.key`)} />
            <TextField
              label="Libellé"
              containerClassName="flex-1"
              {...register(`urgency.${i}.label`)}
            />
            <TextField
              label="Majoration (%)"
              type="number"
              containerClassName="w-36"
              {...register(`urgency.${i}.percent`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Retirer"
              onClick={() => urgency.remove(i)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => urgency.append({ key: '', label: '', percent: 0 })}
        >
          <Plus aria-hidden />
          Ajouter un niveau
        </Button>
      </Card>
      <Card className="flex flex-col gap-3">
        <h3 className="text-h4">Frais de déplacement par commune</h3>
        <p className="text-body-sm text-ink-muted">
          Une commune absente de la liste est chiffrée sur devis.
        </p>
        {travel.fields.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-end gap-2">
            <SelectField
              label="Commune"
              containerClassName="flex-1"
              options={[...ABIDJAN_COMMUNES, 'Hors Abidjan'].map((c) => ({ value: c, label: c }))}
              {...register(`travel.${i}.commune`)}
            />
            <TextField
              label="Frais (FCFA)"
              type="number"
              step={500}
              containerClassName="w-40"
              {...register(`travel.${i}.fee`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Retirer"
              onClick={() => travel.remove(i)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => travel.append({ commune: 'Cocody', fee: 5000 })}
        >
          <Plus aria-hidden />
          Ajouter une commune
        </Button>
      </Card>
      <Card className="flex flex-col gap-3">
        <h3 className="text-h4">Remise volume</h3>
        <p className="text-body-sm text-ink-muted">
          Sur les services facturés à l’unité, à partir d’une quantité.
        </p>
        {volume.fields.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-end gap-2">
            <TextField
              label="À partir de (unités)"
              type="number"
              containerClassName="w-44"
              {...register(`volumeDiscount.${i}.minQuantity`)}
            />
            <TextField
              label="Remise (%)"
              type="number"
              containerClassName="w-32"
              {...register(`volumeDiscount.${i}.percent`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Retirer"
              onClick={() => volume.remove(i)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => volume.append({ minQuantity: 10, percent: 5 })}
        >
          <Plus aria-hidden />
          Ajouter un palier
        </Button>
      </Card>
      <Button
        type="submit"
        variant="secondary"
        className="self-end"
        disabled={!isDirty}
        loading={save.isPending}
      >
        Enregistrer les règles
      </Button>
    </form>
  );
}

export function PricingRulesPanel() {
  const query = useQuery({
    queryKey: ['private', 'admin', 'pricing-rules'],
    queryFn: () => apiRequest<Rules>('/admin/pricing-rules'),
  });
  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  return <RulesForm rules={query.data} />;
}

// --- Formules de maintenance ------------------------------------------------------------------

type PlanRow = MaintenancePlan & { isActive: boolean };
type PlanOutput = z.output<typeof adminPlanSchema>;

function PlanForm({ plan, onDone }: { plan: PlanRow; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [features, setFeatures] = useState(
    plan.features
      .map((f) => `${f.label} | ${f.value === true ? 'oui' : f.value === false ? 'non' : f.value}`)
      .join('\n'),
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminPlanInput, unknown, PlanOutput>({
    resolver: zodResolver(adminPlanSchema),
    defaultValues: { ...plan, maxSeats: plan.maxSeats ?? null },
  });
  const save = useMutation({
    mutationFn: (v: PlanOutput) =>
      apiRequest(`/admin/plans/${plan.id}`, { method: 'PUT', json: v }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'plans'] });
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      toast('Formule enregistrée', { variant: 'success' });
      onDone();
    },
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => {
        // Une caractéristique par ligne : « libellé | oui, non ou texte ».
        const parsed = features
          .split('\n')
          .map((l) => l.split('|').map((s) => s.trim()))
          .filter((p) => p[0])
          .map(([label, raw = 'oui'], i) => ({
            key: plan.features[i]?.key ?? `f${i}`,
            label: label!,
            value: raw === 'oui' ? true : raw === 'non' ? false : raw,
          }));
        save.mutate({ ...v, features: parsed });
      })}
      className="grid gap-4 sm:grid-cols-2"
    >
      {save.isError && (
        <Alert variant="danger" className="sm:col-span-2">
          {save.error.message}
        </Alert>
      )}
      <TextField label="Nom" {...register('name')} />
      <TextField label="Accroche" {...register('tagline')} />
      <TextField
        label="Forfait mensuel (FCFA)"
        type="number"
        step={500}
        error={errors.basePriceMonthly?.message}
        {...register('basePriceMonthly')}
      />
      <TextField
        label="Par poste et par mois (FCFA)"
        type="number"
        step={500}
        error={errors.pricePerSeatMonthly?.message}
        {...register('pricePerSeatMonthly')}
      />
      <TextField label="Remise annuelle (%)" type="number" {...register('annualDiscountPercent')} />
      <TextField
        label="Visites incluses par mois"
        type="number"
        {...register('includedVisitsPerMonth')}
      />
      <TextField label="Postes minimum" type="number" {...register('minSeats')} />
      <TextField
        label="Postes maximum (vide : illimité)"
        type="number"
        {...register('maxSeats', {
          setValueAs: (v: string) => (v === '' || v === null ? null : Number(v)),
        })}
      />
      <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-4">
        <legend className="mb-1 text-label text-ink">Délais cibles (heures ouvrées)</legend>
        {(['critique', 'haute', 'normale', 'basse'] as const).map((p) => (
          <TextField
            key={p}
            label={p.charAt(0).toUpperCase() + p.slice(1)}
            type="number"
            min={1}
            {...register(`sla.${p}`)}
          />
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-label text-ink">Profils ciblés</legend>
        <div className="flex flex-wrap gap-4">
          {CLIENT_PROFILES.map((p) => (
            <Checkbox
              key={p}
              label={PROFILE_META[p].label}
              value={p}
              {...register('targetProfiles')}
            />
          ))}
        </div>
      </fieldset>
      <TextArea
        label="Caractéristiques (comparateur)"
        containerClassName="sm:col-span-2"
        rows={6}
        help="Une par ligne : libellé | oui, non ou texte"
        value={features}
        onChange={(e) => setFeatures(e.target.value)}
      />
      <Checkbox label="Assistance à distance" {...register('remoteSupport')} />
      <Checkbox label="Mise en avant" {...register('highlighted')} />
      <Checkbox label="Proposée sur le site" {...register('isActive')} />
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

export function PlansPanel() {
  const query = useQuery({
    queryKey: ['private', 'admin', 'plans'],
    queryFn: () => apiRequest<PlanRow[]>('/admin/plans'),
  });
  const [editing, setEditing] = useState<PlanRow | null>(null);
  if (query.isPending) return <Skeleton className="h-64" />;
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {query.data.map((p) => (
        <Card key={p.id} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-h4">{p.name}</h3>
            <span className="flex gap-1">
              {p.isPlaceholderPrice && <Badge variant="warning">Exemple</Badge>}
              {!p.isActive && <Badge>Masquée</Badge>}
            </span>
          </div>
          <p className="text-body-sm text-ink-muted">
            {formatFcfa(p.basePriceMonthly)} + {formatFcfa(p.pricePerSeatMonthly)} / poste / mois
          </p>
          <p className="text-caption text-ink-muted">
            Délai critique : {p.sla.critique} h · haute : {p.sla.haute} h
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-auto self-start"
            onClick={() => setEditing(p)}
          >
            <Pencil aria-hidden />
            Modifier
          </Button>
        </Card>
      ))}
      <Modal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Formule ${editing.name}` : 'Formule'}
      >
        {editing && <PlanForm plan={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
