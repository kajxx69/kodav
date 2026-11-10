import { zodResolver } from '@hookform/resolvers/zod';
import {
  CLIENT_PROFILES,
  DURATION_UNITS,
  INTERVENTION_MODES,
  INTERVENTION_MODE_LABELS,
  PRICING_MODES,
  PROFILE_META,
  adminServiceFullSchema,
  type AdminService,
  type AdminServiceFullInput,
} from '@kodav/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegister,
} from 'react-hook-form';
import type { z } from 'zod';
import { Alert, Button, Checkbox, SelectField, TextArea, TextField, toast } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { applyServerErrors } from '~/lib/forms';

type Output = z.output<typeof adminServiceFullSchema>;
type Category = { id: string; name: string };
const MODE_LABELS = { forfait: 'Forfait', par_unite: 'Par unité', sur_devis: 'Sur devis' } as const;
const UNIT_LABELS = { heure: 'heures', jour: 'jours', semaine: 'semaines' } as const;

/** Choix d'une option « liste » : une ligne « valeur | libellé | fixe ou % | min | max ». */
function choicesToText(choices: AdminService['options'][number]['choices']) {
  return (choices ?? [])
    .map((c) =>
      [
        c.value,
        c.label,
        c.impact?.kind === 'percent' ? '%' : 'fixe',
        c.impact?.min ?? 0,
        c.impact?.max ?? 0,
      ].join(' | '),
    )
    .join('\n');
}
function textToChoices(text: string) {
  return text
    .split('\n')
    .map((l) => l.split('|').map((s) => s.trim()))
    .filter((p) => p[0] && p[1])
    .map(([value, label, kind, min, max]) => ({
      value: value!,
      label: label!,
      impact: {
        kind: kind === '%' ? ('percent' as const) : ('fixed' as const),
        min: Number(min) || 0,
        max: Number(max) || Number(min) || 0,
      },
    }));
}

function OptionRow({
  index,
  control,
  register,
  remove,
  setChoices,
}: {
  index: number;
  control: Control<AdminServiceFullInput, unknown, Output>;
  register: UseFormRegister<AdminServiceFullInput>;
  remove: () => void;
  setChoices: (choices: ReturnType<typeof textToChoices>) => void;
}) {
  const type = useWatch({ control, name: `options.${index}.type` });
  const choices = useWatch({ control, name: `options.${index}.choices` });
  const [choiceText, setChoiceText] = useState(() =>
    choicesToText(choices as AdminService['options'][number]['choices']),
  );
  return (
    <div className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-4">
      <TextField label="Clé" placeholder="pages" {...register(`options.${index}.key`)} />
      <TextField
        label="Libellé"
        containerClassName="sm:col-span-2"
        {...register(`options.${index}.label`)}
      />
      <SelectField
        label="Type"
        options={[
          { value: 'boolean', label: 'Oui / non' },
          { value: 'number', label: 'Nombre' },
          { value: 'select', label: 'Liste' },
        ]}
        {...register(`options.${index}.type`)}
      />
      {type === 'select' ? (
        <TextArea
          label="Choix"
          containerClassName="sm:col-span-4"
          rows={3}
          help="Une ligne par choix : valeur | libellé | fixe ou % | min | max"
          value={choiceText}
          onChange={(e) => {
            setChoiceText(e.target.value);
            setChoices(textToChoices(e.target.value));
          }}
        />
      ) : (
        <>
          <SelectField
            label="Impact"
            options={[
              { value: 'fixed', label: 'Montant fixe' },
              { value: 'percent', label: 'Pourcentage' },
            ]}
            {...register(`options.${index}.impact.kind`)}
          />
          <TextField
            label="Impact min"
            type="number"
            {...register(`options.${index}.impact.min`)}
          />
          <TextField
            label="Impact max"
            type="number"
            {...register(`options.${index}.impact.max`)}
          />
          <Checkbox
            label="Par unité"
            className="self-end"
            {...register(`options.${index}.perUnit`)}
          />
          {type === 'number' && (
            <>
              <TextField
                label="Valeur minimale"
                type="number"
                {...register(`options.${index}.min`)}
              />
              <TextField
                label="Valeur maximale"
                type="number"
                {...register(`options.${index}.max`)}
              />
            </>
          )}
        </>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start sm:col-span-4 sm:justify-self-end"
        onClick={remove}
      >
        <Trash2 aria-hidden />
        Retirer l’option
      </Button>
    </div>
  );
}

export function ServiceEditor({
  service,
  categories,
  onDone,
}: {
  service: AdminService | null;
  categories: Category[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<AdminServiceFullInput, unknown, Output>({
    resolver: zodResolver(adminServiceFullSchema),
    defaultValues: service
      ? {
          ...service,
          categoryId: categories.find((c) => c.name === service.category.name)?.id ?? '',
          unitLabel: service.unitLabel ?? '',
          options: service.options.map((o) => ({
            ...o,
            impact: o.impact ?? { kind: 'fixed', min: 0, max: 0 },
          })),
          seo: {
            title: service.seo.title,
            description: service.seo.description,
            keywords: service.seo.keywords ?? [],
          },
        }
      : {
          categoryId: categories[0]?.id ?? '',
          slug: '',
          name: '',
          targetProfiles: ['pme'],
          estimatedDuration: { min: 1, max: 2, unit: 'heure' },
          pricingMode: 'forfait',
          modes: ['sur_site'],
          options: [],
          featured: false,
          isActive: true,
          order: 0,
        },
  });
  const options = useFieldArray({ control, name: 'options' });
  const pricingMode = useWatch({ control, name: 'pricingMode' });
  const amount = {
    setValueAs: (v: string) => (v === '' || v === undefined ? undefined : Number(v)),
  };

  const save = useMutation({
    mutationFn: (v: Output) =>
      apiRequest<AdminService>(service ? `/admin/services/${service.id}` : '/admin/services', {
        method: service ? 'PUT' : 'POST',
        json: {
          ...v,
          // Une option sans impact renseigné n'en a pas.
          options: v.options.map((o) =>
            o.type === 'select' || (o.impact && (o.impact.min || o.impact.max))
              ? o
              : { ...o, impact: undefined },
          ),
        },
      }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'services'] });
      void queryClient.invalidateQueries({ queryKey: ['catalog'] });
      toast(service ? 'Service mis à jour' : 'Service créé', { variant: 'success' });
      onDone();
    },
    onError: (err) =>
      setFormError(
        applyServerErrors(err, setError, [
          'slug',
          'name',
          'priceMin',
          'priceMax',
          'targetProfiles',
          'modes',
          'categoryId',
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
        label="Pôle"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
        error={errors.categoryId?.message}
        {...register('categoryId')}
      />
      <TextField label="Nom" required error={errors.name?.message} {...register('name')} />
      <TextField
        label="Adresse de la page"
        required
        help="Ex. : depannage → /services/pole/depannage"
        error={errors.slug?.message}
        {...register('slug')}
      />
      <TextField label="Ordre d’affichage" type="number" {...register('order')} />
      <TextArea
        label="Accroche"
        containerClassName="sm:col-span-2"
        rows={2}
        {...register('shortDescription')}
      />
      <TextArea
        label="Description détaillée (Markdown simple)"
        containerClassName="sm:col-span-2"
        rows={6}
        {...register('longDescription')}
      />

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
        {errors.targetProfiles?.message && (
          <p className="text-body-sm text-danger">{errors.targetProfiles.message}</p>
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-label text-ink">Modes d’intervention</legend>
        <div className="flex flex-wrap gap-4">
          {INTERVENTION_MODES.map((m) => (
            <Checkbox
              key={m}
              label={INTERVENTION_MODE_LABELS[m]}
              value={m}
              {...register('modes')}
            />
          ))}
        </div>
        {errors.modes?.message && (
          <p className="text-body-sm text-danger">{errors.modes.message}</p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
        <TextField label="Durée min" type="number" {...register('estimatedDuration.min')} />
        <TextField
          label="Durée max"
          type="number"
          error={errors.estimatedDuration?.max?.message}
          {...register('estimatedDuration.max')}
        />
        <SelectField
          label="Unité"
          options={DURATION_UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
          {...register('estimatedDuration.unit')}
        />
      </div>

      <SelectField
        label="Tarification"
        options={PRICING_MODES.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
        {...register('pricingMode')}
      />
      {pricingMode === 'par_unite' ? (
        <TextField label="Unité" placeholder="poste, heure…" {...register('unitLabel')} />
      ) : (
        <span />
      )}
      {pricingMode !== 'sur_devis' && (
        <>
          <TextField
            label="Prix minimum (FCFA)"
            type="number"
            step={500}
            error={errors.priceMin?.message}
            {...register('priceMin', amount)}
          />
          <TextField
            label="Prix maximum (FCFA)"
            type="number"
            step={500}
            error={errors.priceMax?.message}
            {...register('priceMax', amount)}
          />
        </>
      )}

      <fieldset className="flex flex-col gap-3 sm:col-span-2">
        <legend className="mb-1 text-label text-ink">Options du configurateur</legend>
        {options.fields.map((f, i) => (
          <OptionRow
            key={f.id}
            index={i}
            control={control}
            register={register}
            remove={() => options.remove(i)}
            setChoices={(choices) =>
              setValue(`options.${i}.choices`, choices, { shouldDirty: true })
            }
          />
        ))}
        {errors.options?.root?.message && (
          <p className="text-body-sm text-danger">{errors.options.root.message}</p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() =>
            options.append({
              key: '',
              label: '',
              type: 'boolean',
              impact: { kind: 'fixed', min: 0, max: 0 },
            })
          }
        >
          <Plus aria-hidden />
          Ajouter une option
        </Button>
      </fieldset>

      <TextField label="Titre SEO" containerClassName="sm:col-span-2" {...register('seo.title')} />
      <TextArea
        label="Description SEO"
        containerClassName="sm:col-span-2"
        rows={2}
        {...register('seo.description')}
      />
      <Checkbox label="Visible sur le site" {...register('isActive')} />
      <Checkbox label="Mis en avant sur l’accueil" {...register('featured')} />
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
