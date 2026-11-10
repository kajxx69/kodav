import {
  ABIDJAN_COMMUNES,
  INTERVENTION_MODE_LABELS,
  formatFcfa,
  type CategoryWithServices,
  type InterventionMode,
  type Service,
} from '@kodav/shared';
import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  ChoiceCards,
  SelectField,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
  TextField,
} from '~/components/ui';
import { durationLabel, priceLabel } from '~/lib/format';
import type { PricingRulesPublic } from '~/lib/queries';
import { useDraftStore } from './draftStore';

export function ServiceStep({ catalog }: { catalog: CategoryWithServices[] }) {
  const items = useDraftStore((s) => s.items);
  const toggle = useDraftStore((s) => s.toggleService);
  const selected = items.map((i) => i.serviceId);
  const countFor = (pole: CategoryWithServices) =>
    pole.services.filter((s) => selected.includes(s.id)).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink-muted">
        Choisissez un ou plusieurs services : vous préciserez les quantités et options à l’étape
        suivante.
      </p>
      <Tabs defaultValue={catalog[0]?.slug}>
        <TabsList aria-label="Pôles">
          {catalog.map((pole) => (
            <TabsTrigger key={pole.slug} value={pole.slug}>
              {pole.name}
              {countFor(pole) > 0 && (
                <Badge variant="gold" className="ml-2">
                  {countFor(pole)}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {catalog.map((pole) => (
          <TabsContent key={pole.slug} value={pole.slug}>
            <ChoiceCards
              multiple
              legend={`Services du pôle ${pole.name}`}
              hideLegend
              value={selected}
              onChange={toggle}
              choices={pole.services.map((s) => ({
                value: s.id,
                label: s.name,
                description: s.shortDescription,
                aside: priceLabel(s),
              }))}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function OptionField({
  service,
  option,
  value,
  onChange,
}: {
  service: Service;
  option: Service['options'][number];
  value: boolean | string | number | undefined;
  onChange: (value: boolean | string | number) => void;
}) {
  const id = `${service.id}-${option.key}`;
  switch (option.type) {
    case 'boolean':
      return (
        <Checkbox
          id={id}
          label={option.label}
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'select':
      return (
        <SelectField
          id={id}
          label={option.label}
          placeholder="Aucun"
          options={(option.choices ?? []).map((c) => ({ value: c.value, label: c.label }))}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <TextField
          id={id}
          type="number"
          inputMode="numeric"
          label={option.label}
          min={option.min ?? 0}
          max={option.max}
          value={typeof value === 'number' ? value : 0}
          help={option.max !== undefined ? `De ${option.min ?? 0} à ${option.max}` : undefined}
          onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
        />
      );
  }
}

export function DetailsStep({ services }: { services: Map<string, Service> }) {
  const items = useDraftStore((s) => s.items);
  const updateItem = useDraftStore((s) => s.updateItem);
  const toggle = useDraftStore((s) => s.toggleService);

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const service = services.get(item.serviceId);
        if (!service) return null;
        return (
          <section
            key={item.serviceId}
            aria-labelledby={`item-${item.serviceId}`}
            className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={`item-${item.serviceId}`} className="text-h4">
                  {service.name}
                </h3>
                <p className="text-body-sm text-ink-muted">
                  {priceLabel(service)} · {durationLabel(service.estimatedDuration)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Retirer ${service.name}`}
                onClick={() => toggle(service.id)}
              >
                <Trash2 className="size-5" aria-hidden />
              </Button>
            </div>
            {service.pricingMode === 'sur_devis' && (
              <p className="text-body-sm text-ink-muted">
                Ce service est chiffré sur devis : décrivez votre besoin à la dernière étape.
              </p>
            )}
            {(service.pricingMode === 'par_unite' || service.options.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {service.pricingMode === 'par_unite' && (
                  <TextField
                    type="number"
                    inputMode="numeric"
                    label={`Nombre de ${service.unitLabel ?? 'unités'}s`}
                    min={1}
                    max={1000}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.serviceId, {
                        quantity: Math.min(
                          1000,
                          Math.max(1, Math.round(Number(e.target.value) || 1)),
                        ),
                      })
                    }
                  />
                )}
                {service.options.map((option) => (
                  <OptionField
                    key={option.key}
                    service={service}
                    option={option}
                    value={item.options[option.key]}
                    onChange={(value) =>
                      updateItem(item.serviceId, {
                        options: { ...item.options, [option.key]: value },
                      })
                    }
                  />
                ))}
              </div>
            )}
            {service.pricingMode !== 'par_unite' && service.options.length === 0 && (
              <p className="text-body-sm text-ink-muted">Aucune option pour ce service.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

const COMMUNE_OPTIONS = [...ABIDJAN_COMMUNES, 'Hors Abidjan'] as const;

export function InterventionStep({
  services,
  rules,
}: {
  services: Service[];
  rules: PricingRulesPublic | undefined;
}) {
  const { urgency, mode, commune, address, update } = useDraftStore();
  // Modes proposés : ceux qu'au moins un des services choisis accepte.
  const modes = useMemo(() => {
    const set = new Set<InterventionMode>(services.flatMap((s) => s.modes));
    return (['sur_site', 'distance', 'atelier'] as const).filter((m) => set.has(m));
  }, [services]);
  const fees = new Map(rules?.communes.map((c) => [c.commune, c.fee]));

  return (
    <div className="flex flex-col gap-8">
      <ChoiceCards
        legend="Délai souhaité"
        columns={3}
        value={urgency}
        onChange={(value) => update({ urgency: value })}
        choices={(rules?.urgency ?? [{ key: 'standard', label: 'Standard', percent: 0 }]).map(
          (u) => ({
            value: u.key,
            label: u.label,
            description: u.percent ? `Majoration de ${u.percent} %` : 'Selon notre planning',
          }),
        )}
      />
      <ChoiceCards
        legend="Où intervenir ?"
        columns={3}
        value={modes.includes(mode) ? mode : undefined}
        onChange={(value) => update({ mode: value })}
        choices={modes.map((m) => ({
          value: m,
          label: INTERVENTION_MODE_LABELS[m],
          description:
            m === 'sur_site'
              ? 'Un technicien se déplace chez vous'
              : m === 'distance'
                ? 'Prise en main à distance sécurisée'
                : 'Vous déposez le matériel',
        }))}
      />
      {mode === 'sur_site' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Commune"
            required
            placeholder="Choisir…"
            options={COMMUNE_OPTIONS.map((c) => ({
              value: c,
              label: fees.has(c) ? `${c} (déplacement ${formatFcfa(fees.get(c)!)})` : c,
            }))}
            value={commune ?? ''}
            onChange={(e) => update({ commune: (e.target.value || undefined) as typeof commune })}
            help={
              commune === 'Hors Abidjan' ? 'Frais de déplacement chiffrés sur devis.' : undefined
            }
          />
          <TextField
            label="Adresse ou repère"
            autoComplete="street-address"
            placeholder="Quartier, rue, immeuble…"
            value={address}
            maxLength={300}
            onChange={(e) => update({ address: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

export function NotesField() {
  const clientNotes = useDraftStore((s) => s.clientNotes);
  const update = useDraftStore((s) => s.update);
  return (
    <TextArea
      label="Précisions sur votre besoin"
      containerClassName="sm:col-span-2"
      maxLength={3000}
      placeholder="Contexte, matériel existant, contraintes d’horaires…"
      value={clientNotes}
      onChange={(e) => update({ clientNotes: e.target.value })}
    />
  );
}
