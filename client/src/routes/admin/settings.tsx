import { zodResolver } from '@hookform/resolvers/zod';
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_KEYS,
  EXPORT_ENTITIES,
  adminSettingsSchema,
  type AdminSettingsDto,
  type AdminSettingsInput,
  type AuditLogDto,
  type Paginated,
} from '@kodav/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Alert,
  Button,
  Card,
  DataTable,
  ErrorState,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
  TextField,
  toast,
  type Column,
} from '~/components/ui';
import { apiRequest, downloadProtectedFile } from '~/lib/api';
import { formatDateTime } from '~/lib/format';
import { applyServerErrors } from '~/lib/forms';

const EXPORT_LABELS: Record<(typeof EXPORT_ENTITIES)[number], string> = {
  devis: 'Devis',
  factures: 'Factures',
  prospects: 'Prospects',
  clients: 'Clients',
  tickets: 'Tickets',
  interventions: 'Interventions',
};

function SettingsForm({ settings }: { settings: AdminSettingsDto }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  // Chaque modèle d'email est toujours présent dans le formulaire (vide = texte par défaut).
  const templates = EMAIL_TEMPLATE_KEYS.map(
    (key) => settings.emailTemplates.find((t) => t.key === key) ?? { key, subject: '', body: '' },
  );
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<AdminSettingsInput, unknown, AdminSettingsDto>({
    resolver: zodResolver(adminSettingsSchema),
    defaultValues: { ...settings, emailTemplates: templates },
  });
  const hours = useFieldArray({ control, name: 'brand.openingHours' });
  const stats = useFieldArray({ control, name: 'stats' });
  const save = useMutation({
    mutationFn: (v: AdminSettingsDto) =>
      apiRequest<AdminSettingsDto>('/admin/settings', {
        method: 'PUT',
        json: { ...v, emailTemplates: v.emailTemplates.filter((t) => t.subject || t.body) },
      }),
    onSuccess(saved) {
      reset({
        ...saved,
        emailTemplates: EMAIL_TEMPLATE_KEYS.map(
          (key) =>
            saved.emailTemplates.find((t) => t.key === key) ?? { key, subject: '', body: '' },
        ),
      });
      // Identité affichée sur le site : rechargée.
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast('Paramètres enregistrés', { variant: 'success' });
    },
    onError: (err) =>
      setFormError(
        applyServerErrors(err, setError, ['brand.phone', 'brand.whatsapp', 'brand.email']),
      ),
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
      <Tabs defaultValue="entreprise">
        <TabsList aria-label="Paramètres">
          <TabsTrigger value="entreprise">Entreprise</TabsTrigger>
          <TabsTrigger value="chiffres">Chiffres clés</TabsTrigger>
          <TabsTrigger value="facturation">Devis et factures</TabsTrigger>
          <TabsTrigger value="emails">Modèles d’emails</TabsTrigger>
        </TabsList>

        <TabsContent value="entreprise">
          <Card className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Raison sociale"
              {...register('brand.legalName')}
              error={errors.brand?.legalName?.message}
            />
            <TextField
              label="Nom court"
              {...register('brand.shortName')}
              error={errors.brand?.shortName?.message}
            />
            <TextField
              label="Slogan"
              containerClassName="sm:col-span-2"
              {...register('brand.tagline')}
            />
            <TextField
              label="Téléphone"
              placeholder="+2250700000000"
              help="Format +225 suivi de 10 chiffres. Les boutons Appeler et WhatsApp apparaissent une fois le vrai numéro saisi."
              {...register('brand.phone')}
              error={errors.brand?.phone?.message}
            />
            <TextField
              label="WhatsApp"
              placeholder="+2250700000000"
              {...register('brand.whatsapp')}
              error={errors.brand?.whatsapp?.message}
            />
            <TextField
              label="Email"
              type="email"
              {...register('brand.email')}
              error={errors.brand?.email?.message}
            />
            <TextField label="Adresse" {...register('brand.address')} />
            <TextField
              label="Zone d’intervention"
              containerClassName="sm:col-span-2"
              {...register('brand.serviceArea')}
            />
            <fieldset className="flex flex-col gap-2 sm:col-span-2">
              <legend className="mb-1 text-label text-ink">Horaires affichés</legend>
              {hours.fields.map((f, i) => (
                <div key={f.id} className="flex items-end gap-2">
                  <TextField
                    label="Jours"
                    containerClassName="flex-1"
                    {...register(`brand.openingHours.${i}.days`)}
                  />
                  <TextField
                    label="Heures"
                    containerClassName="flex-1"
                    {...register(`brand.openingHours.${i}.hours`)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Retirer"
                    onClick={() => hours.remove(i)}
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
                onClick={() => hours.append({ days: '', hours: '' })}
              >
                <Plus aria-hidden />
                Ajouter une ligne
              </Button>
            </fieldset>
            {(['facebook', 'linkedin', 'instagram', 'tiktok'] as const).map((n) => (
              <TextField
                key={n}
                label={n.charAt(0).toUpperCase() + n.slice(1)}
                type="url"
                placeholder="https://…"
                {...register(`brand.social.${n}`)}
                error={errors.brand?.social?.[n]?.message}
              />
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="chiffres">
          <Card className="flex flex-col gap-3">
            <p className="text-body-sm text-ink-muted">
              Uniquement des chiffres réels et vérifiables. La section « Chiffres clés » du site
              reste masquée tant que la liste est vide.
            </p>
            {stats.fields.map((f, i) => (
              <div key={f.id} className="flex flex-wrap items-end gap-2">
                <TextField
                  label="Libellé"
                  containerClassName="flex-1"
                  {...register(`stats.${i}.label`)}
                />
                <TextField
                  label="Valeur"
                  type="number"
                  containerClassName="w-32"
                  {...register(`stats.${i}.value`)}
                />
                <TextField
                  label="Suffixe"
                  placeholder="+, %"
                  containerClassName="w-24"
                  {...register(`stats.${i}.suffix`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Retirer"
                  onClick={() => stats.remove(i)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            {stats.fields.length < 6 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => stats.append({ label: '', value: 0, suffix: '' })}
              >
                <Plus aria-hidden />
                Ajouter un chiffre
              </Button>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="facturation">
          <Card className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Validité des devis (jours)"
              type="number"
              min={1}
              {...register('quote.validityDays')}
            />
            <TextField
              label="Taux de TVA (%)"
              type="number"
              min={0}
              step="0.5"
              help="0 si vous n’êtes pas assujetti : la facture indique « Non applicable »."
              {...register('invoice.taxRate')}
            />
            <TextArea
              label="Mentions légales des factures"
              containerClassName="sm:col-span-2"
              placeholder="RCCM, n° de compte contribuable, régime d’imposition…"
              {...register('invoice.legalMentions')}
            />
            <TextArea
              label="Coordonnées de paiement"
              containerClassName="sm:col-span-2"
              placeholder="Banque, IBAN, numéro Mobile Money…"
              {...register('invoice.bankDetails')}
            />
          </Card>
        </TabsContent>

        <TabsContent value="emails">
          <div className="flex flex-col gap-4">
            <Alert>
              Laissez un champ vide pour garder le texte par défaut. Séparez les paragraphes par une
              ligne vide. Variables entre doubles accolades, par exemple {'{{prenom}}'}.
            </Alert>
            {templates.map((t, i) => (
              <Card key={t.key} className="grid gap-3">
                <h3 className="text-h4">{EMAIL_TEMPLATES[t.key].label}</h3>
                <p className="text-caption text-ink-muted">
                  Variables : {EMAIL_TEMPLATES[t.key].variables.map((v) => `{{${v}}}`).join(', ')}
                </p>
                <input type="hidden" {...register(`emailTemplates.${i}.key`)} />
                <TextField label="Objet" {...register(`emailTemplates.${i}.subject`)} />
                <TextArea label="Texte" rows={5} {...register(`emailTemplates.${i}.body`)} />
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" size="lg" disabled={!isDirty} loading={save.isPending}>
          Enregistrer les paramètres
        </Button>
      </div>
    </form>
  );
}

const auditColumns: Column<AuditLogDto>[] = [
  { key: 'at', header: 'Date', cell: (l) => formatDateTime(l.at), sortValue: (l) => l.at },
  { key: 'actor', header: 'Par', cell: (l) => l.actor?.name ?? '—' },
  {
    key: 'action',
    header: 'Action',
    cell: (l) => <code className="text-caption">{l.action}</code>,
  },
  {
    key: 'summary',
    header: 'Détail',
    cell: (l) => <span className="line-clamp-2">{l.summary || l.entity}</span>,
  },
  {
    key: 'ip',
    header: 'Adresse IP',
    cell: (l) => <span className="text-caption text-ink-muted">{l.ip}</span>,
  },
];

function AuditLog() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['private', 'admin', 'audit', page],
    queryFn: () => apiRequest<Paginated<AuditLogDto>>(`/admin/audit-logs?page=${page}&limit=50`),
    placeholderData: keepPreviousData,
  });
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / 50)) : 1;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-ink-muted">
        Actions de l’équipe : devis, factures, planning, paramètres, révélation de clés de licence,
        exports.
      </p>
      <DataTable
        caption="Journal d’audit"
        columns={auditColumns}
        rows={query.data?.items}
        rowKey={(l) => l.id}
        loading={query.isPending}
        emptyTitle="Aucune action enregistrée"
      />
      {pages > 1 && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminSettings() {
  const query = useQuery({
    queryKey: ['private', 'admin', 'settings'],
    queryFn: () => apiRequest<AdminSettingsDto>('/admin/settings'),
  });
  return (
    <>
      <SpaceHeader
        title="Paramètres"
        lead="Identité de l’entreprise, facturation, modèles d’emails, journal et exports. Horaires et créneaux : voir le Planning ; tarifs et formules : voir le Catalogue."
      />
      <Tabs defaultValue="general">
        <TabsList aria-label="Section">
          <TabsTrigger value="general">Général</TabsTrigger>
          <TabsTrigger value="journal">Journal d’audit</TabsTrigger>
          <TabsTrigger value="exports">Exports</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          {query.isPending ? (
            <Skeleton className="h-96" />
          ) : query.isError ? (
            <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
          ) : (
            <SettingsForm settings={query.data} />
          )}
        </TabsContent>
        <TabsContent value="journal">
          <AuditLog />
        </TabsContent>
        <TabsContent value="exports">
          <Card className="flex flex-col gap-3">
            <p className="text-body-sm text-ink-muted">
              Fichiers CSV compatibles Excel (séparateur point-virgule). Chaque export est
              enregistré dans le journal.
            </p>
            <div className="flex flex-wrap gap-2">
              {EXPORT_ENTITIES.map((e) => (
                <Button
                  key={e}
                  variant="outline"
                  onClick={() =>
                    downloadProtectedFile(`/admin/export/${e}.csv`).catch((err: Error) =>
                      toast('Export impossible', { description: err.message, variant: 'error' }),
                    )
                  }
                >
                  <Download aria-hidden />
                  {EXPORT_LABELS[e]}
                </Button>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
