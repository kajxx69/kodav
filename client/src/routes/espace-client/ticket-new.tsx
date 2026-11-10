import { zodResolver } from '@hookform/resolvers/zod';
import {
  ASSET_TYPE_LABELS,
  MAX_ATTACHMENTS,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  createTicketSchema,
  type AssetDto,
  type CreateTicketInput,
  type TicketDetailDto,
} from '@kodav/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { z } from 'zod';
import { SpaceHeader } from '~/components/app/AppShell';
import { Alert, Button, Card, SelectField, TextArea, TextField } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { applyServerErrors } from '~/lib/forms';

type Output = z.output<typeof createTicketSchema>;
const PRIORITY_HELP: Record<string, string> = {
  basse: 'Une question, sans gêne au quotidien.',
  normale: 'Gênant, mais le travail continue.',
  haute: 'Un poste ou un service important est bloqué.',
  critique: 'Toute l’activité est arrêtée.',
};

export default function NewTicket() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [files, setFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const assets = useQuery({
    queryKey: ['private', 'assets'],
    queryFn: () => apiRequest<AssetDto[]>('/assets'),
  });
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<CreateTicketInput, unknown, Output>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      subject: '',
      body: '',
      priority: 'normale',
      assetId: params.get('equipement') ?? undefined,
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- aide contextuelle de la priorité
  const priority = watch('priority');

  const create = useMutation({
    mutationFn: (values: Output) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(values)) if (value) form.append(key, String(value));
      for (const f of files) form.append('attachments', f);
      return apiRequest<TicketDetailDto>('/tickets', { method: 'POST', body: form });
    },
    onSuccess: (t) => navigate(`/espace-client/tickets/${t.id}`, { replace: true }),
    onError: (error) =>
      setFormError(applyServerErrors(error, setError, ['subject', 'category', 'body', 'assetId'])),
  });

  return (
    <>
      <Link
        to="/espace-client/tickets"
        className="inline-flex items-center gap-1 text-label text-link"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Support
      </Link>
      <SpaceHeader
        title="Nouvelle demande"
        lead="Plus votre description est précise, plus notre réponse sera rapide."
      />
      <Card>
        <form
          noValidate
          onSubmit={handleSubmit((v) => {
            setFormError(null);
            create.mutate(v);
          })}
          className="grid gap-5 sm:grid-cols-2"
        >
          {formError && (
            <Alert variant="danger" className="sm:col-span-2">
              {formError}
            </Alert>
          )}
          <TextField
            label="Sujet"
            required
            containerClassName="sm:col-span-2"
            placeholder="Ex. : l’imprimante de l’accueil n’imprime plus"
            error={errors.subject?.message}
            {...register('subject')}
          />
          <SelectField
            label="Catégorie"
            required
            placeholder="Choisir…"
            options={TICKET_CATEGORIES.map((c) => ({ value: c, label: TICKET_CATEGORY_LABELS[c] }))}
            error={errors.category?.message}
            {...register('category')}
          />
          <SelectField
            label="Priorité"
            options={TICKET_PRIORITIES.map((p) => ({ value: p, label: TICKET_PRIORITY_LABELS[p] }))}
            help={PRIORITY_HELP[priority ?? 'normale']}
            {...register('priority')}
          />
          {assets.data && assets.data.length > 0 && (
            <SelectField
              label="Équipement concerné"
              placeholder="Aucun en particulier"
              containerClassName="sm:col-span-2"
              options={assets.data
                .filter((a) => a.status !== 'retire')
                .map((a) => ({ value: a.id, label: `${a.name} (${ASSET_TYPE_LABELS[a.type]})` }))}
              {...register('assetId', { setValueAs: (v: string) => v || undefined })}
            />
          )}
          <TextArea
            label="Description"
            required
            containerClassName="sm:col-span-2"
            placeholder="Que se passe-t-il ? Depuis quand ? Message d’erreur éventuel…"
            error={errors.body?.message}
            {...register('body')}
          />
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="ticket-files" className="text-label text-ink">
              Pièces jointes
            </label>
            <input
              id="ticket-files"
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_ATTACHMENTS))}
              className="text-body-sm text-ink-muted file:mr-3 file:rounded-md file:border file:border-field-border file:bg-surface-raised file:px-3 file:py-2 file:text-label file:text-ink"
            />
            <p className="text-caption text-ink-muted">
              Capture d’écran ou photo du message d’erreur : JPEG, PNG ou PDF, 5 Mo maximum,{' '}
              {MAX_ATTACHMENTS} fichiers.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="lg" loading={create.isPending}>
              Envoyer la demande
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
