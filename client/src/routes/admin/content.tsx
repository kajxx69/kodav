import { zodResolver } from '@hookform/resolvers/zod';
import {
  adminFaqSchema,
  adminProjectSchema,
  type AdminProjectInput,
  type AdminTestimonialDto,
} from '@kodav/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
  TextField,
  toast,
} from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { formatDate } from '~/lib/format';
import { applyServerErrors } from '~/lib/forms';

const KEY = ['private', 'admin', 'content'];

function useRemove(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/content/${path}/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

// --- Avis -------------------------------------------------------------------------------

function Testimonials() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...KEY, 'testimonials'],
    queryFn: () => apiRequest<AdminTestimonialDto[]>('/admin/content/testimonials'),
  });
  const update = useMutation({
    mutationFn: (t: AdminTestimonialDto) =>
      apiRequest(`/admin/content/testimonials/${t.id}`, {
        method: 'PUT',
        json: {
          authorName: t.authorName,
          role: t.role,
          company: t.company,
          profile: t.profile,
          content: t.content,
          rating: t.rating,
          status: t.status,
          order: t.order,
        },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
  });
  const remove = useRemove('testimonials');
  if (query.isPending) return <Skeleton className="h-48" />;
  if (query.isError)
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  if (!query.data.length) {
    return (
      <EmptyState
        icon={Star}
        title="Aucun avis"
        description="Les avis déposés par vos clients depuis leur espace arrivent ici pour validation. Rien n’est publié sans votre accord."
      />
    );
  }
  return (
    <div className="grid gap-4">
      {query.data.map((t) => (
        <Card key={t.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-label text-ink">{t.authorName}</span>
              {t.company && <span className="text-body-sm text-ink-muted">{t.company}</span>}
              <Badge
                variant={
                  t.status === 'publie' ? 'success' : t.status === 'rejete' ? 'neutral' : 'warning'
                }
              >
                {t.status === 'publie' ? 'Publié' : t.status === 'rejete' ? 'Refusé' : 'À valider'}
              </Badge>
              {t.fromClient && <Badge>Déposé par le client</Badge>}
            </p>
            <span className="text-body-sm text-gold-ink" aria-label={`${t.rating} sur 5`}>
              {'★'.repeat(t.rating)}
              {'☆'.repeat(5 - t.rating)}
            </span>
          </div>
          <p className="text-body text-ink">« {t.content} »</p>
          <p className="text-caption text-ink-muted">{formatDate(t.createdAt)}</p>
          <div className="flex flex-wrap gap-2">
            {t.status !== 'publie' && (
              <Button
                size="sm"
                variant="secondary"
                loading={update.isPending && update.variables?.id === t.id}
                onClick={() => update.mutate({ ...t, status: 'publie' })}
              >
                <Check aria-hidden />
                Publier
              </Button>
            )}
            {t.status !== 'rejete' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => update.mutate({ ...t, status: 'rejete' })}
              >
                <X aria-hidden />
                {t.status === 'publie' ? 'Retirer' : 'Refuser'}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.confirm('Supprimer cet avis ?') && remove.mutate(t.id)}
            >
              <Trash2 aria-hidden />
              Supprimer
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// --- Réalisations ---------------------------------------------------------------------------

type ProjectRow = Omit<AdminProjectInput, 'images' | 'tags'> & {
  id: string;
  images: { url: string; alt: string }[];
  tags: string[];
  publishedAt: string | null;
};
type ProjectOutput = z.output<typeof adminProjectSchema>;

function ProjectForm({ project, onDone }: { project: ProjectRow | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [images, setImages] = useState(
    project?.images.map((i) => `${i.url} | ${i.alt}`).join('\n') ?? '',
  );
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdminProjectInput, unknown, ProjectOutput>({
    resolver: zodResolver(adminProjectSchema),
    defaultValues: project
      ? { ...project, tags: project.tags }
      : {
          slug: '',
          title: '',
          status: 'brouillon',
          category: '',
          client: '',
          summary: '',
          content: '',
          tags: [],
          images: [],
        },
  });
  const save = useMutation({
    mutationFn: (v: ProjectOutput) =>
      apiRequest(project ? `/admin/content/projects/${project.id}` : '/admin/content/projects', {
        method: project ? 'PUT' : 'POST',
        json: v,
      }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: KEY });
      toast('Réalisation enregistrée', { variant: 'success' });
      onDone();
    },
    onError: (err) => setFormError(applyServerErrors(err, setError, ['slug', 'title'])),
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        // Une image par ligne : « URL | texte alternatif ».
        const parsed = images
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [url, alt = ''] = l.split('|').map((s) => s.trim());
            return { url: url!, alt };
          });
        save.mutate({ ...v, images: parsed });
      })}
      className="grid gap-4 sm:grid-cols-2"
    >
      {formError && (
        <Alert variant="danger" className="sm:col-span-2">
          {formError}
        </Alert>
      )}
      <TextField
        label="Titre"
        required
        containerClassName="sm:col-span-2"
        error={errors.title?.message}
        {...register('title')}
      />
      <TextField
        label="Adresse de la page"
        required
        help="Ex. : reseau-ecole-cocody → /realisations/reseau-ecole-cocody"
        error={errors.slug?.message}
        {...register('slug')}
      />
      <SelectField
        label="Statut"
        options={[
          { value: 'brouillon', label: 'Brouillon' },
          { value: 'publie', label: 'Publié' },
        ]}
        {...register('status')}
      />
      <TextField label="Catégorie" {...register('category')} />
      <TextField label="Client (avec son accord)" {...register('client')} />
      <TextArea label="Résumé" containerClassName="sm:col-span-2" {...register('summary')} />
      <TextArea
        label="Récit (Markdown simple)"
        containerClassName="sm:col-span-2"
        rows={8}
        {...register('content')}
      />
      <TextArea
        label="Images"
        containerClassName="sm:col-span-2"
        help="Une par ligne : URL | description"
        value={images}
        onChange={(e) => setImages(e.target.value)}
      />
      <TextField
        label="Mots-clés"
        help="Séparés par des virgules"
        containerClassName="sm:col-span-2"
        {...register('tags', {
          setValueAs: (v: string | string[]) =>
            Array.isArray(v)
              ? v
              : v
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
        })}
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

function Projects() {
  const query = useQuery({
    queryKey: [...KEY, 'projects'],
    queryFn: () => apiRequest<ProjectRow[]>('/admin/content/projects'),
  });
  const [editing, setEditing] = useState<ProjectRow | 'new' | null>(null);
  const remove = useRemove('projects');
  return (
    <div className="flex flex-col gap-4">
      <Button className="self-start" variant="secondary" onClick={() => setEditing('new')}>
        <Plus aria-hidden />
        Nouvelle réalisation
      </Button>
      {query.isPending ? (
        <Skeleton className="h-32" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState
          icon={Star}
          title="Aucune réalisation"
          description="Présentez uniquement des projets réels, avec l’accord du client. La page Réalisations reste masquée tant qu’elle est vide."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {query.data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span>
                  <span className="flex items-center gap-2 text-label text-ink">
                    {p.title}
                    <Badge variant={p.status === 'publie' ? 'success' : 'neutral'}>
                      {p.status === 'publie' ? 'Publié' : 'Brouillon'}
                    </Badge>
                  </span>
                  <span className="text-caption text-ink-muted">/realisations/{p.slug}</span>
                </span>
                <span className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Modifier ${p.title}`}
                    onClick={() => setEditing(p)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Supprimer ${p.title}`}
                    onClick={() =>
                      window.confirm(`Supprimer « ${p.title} » ?`) && remove.mutate(p.id)
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Modal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? 'Nouvelle réalisation' : 'Modifier la réalisation'}
      >
        {editing !== null && (
          <ProjectForm
            project={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// --- FAQ --------------------------------------------------------------------------------------

type FaqRow = z.output<typeof adminFaqSchema> & { id: string };

function FaqForm({ faq, onDone }: { faq: FaqRow | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof adminFaqSchema>, unknown, z.output<typeof adminFaqSchema>>({
    resolver: zodResolver(adminFaqSchema),
    defaultValues: faq ?? {
      question: '',
      answer: '',
      category: 'general',
      order: 0,
      isPublished: true,
    },
  });
  const save = useMutation({
    mutationFn: (v: z.output<typeof adminFaqSchema>) =>
      apiRequest(faq ? `/admin/content/faqs/${faq.id}` : '/admin/content/faqs', {
        method: faq ? 'PUT' : 'POST',
        json: v,
      }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: KEY });
      onDone();
    },
  });
  return (
    <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-4">
      {save.isError && <Alert variant="danger">{save.error.message}</Alert>}
      <TextField
        label="Question"
        required
        error={errors.question?.message}
        {...register('question')}
      />
      <TextArea
        label="Réponse"
        required
        rows={6}
        error={errors.answer?.message}
        {...register('answer')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Catégorie" {...register('category')} />
        <TextField label="Ordre" type="number" {...register('order')} />
      </div>
      <Checkbox label="Publiée" {...register('isPublished')} />
      <div className="flex justify-end gap-2">
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

function Faqs() {
  const query = useQuery({
    queryKey: [...KEY, 'faqs'],
    queryFn: () => apiRequest<FaqRow[]>('/admin/content/faqs'),
  });
  const [editing, setEditing] = useState<FaqRow | 'new' | null>(null);
  const remove = useRemove('faqs');
  return (
    <div className="flex flex-col gap-4">
      <Button className="self-start" variant="secondary" onClick={() => setEditing('new')}>
        <Plus aria-hidden />
        Nouvelle question
      </Button>
      {query.isPending ? (
        <Skeleton className="h-32" />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {query.data.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 p-4">
                <span>
                  <span className="block text-label text-ink">{f.question}</span>
                  <span className="line-clamp-2 text-body-sm text-ink-muted">{f.answer}</span>
                  {!f.isPublished && <Badge className="mt-1">Masquée</Badge>}
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Modifier"
                    onClick={() => setEditing(f)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer"
                    onClick={() =>
                      window.confirm('Supprimer cette question ?') && remove.mutate(f.id)
                    }
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Modal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? 'Nouvelle question' : 'Modifier la question'}
      >
        {editing !== null && (
          <FaqForm faq={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
        )}
      </Modal>
    </div>
  );
}

export default function AdminContent() {
  return (
    <>
      <SpaceHeader
        title="Contenu"
        lead="Avis clients (publiés après votre validation), réalisations et questions fréquentes."
      />
      <Tabs defaultValue="avis">
        <TabsList aria-label="Type de contenu">
          <TabsTrigger value="avis">Avis clients</TabsTrigger>
          <TabsTrigger value="realisations">Réalisations</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>
        <TabsContent value="avis">
          <Testimonials />
        </TabsContent>
        <TabsContent value="realisations">
          <Projects />
        </TabsContent>
        <TabsContent value="faq">
          <Faqs />
        </TabsContent>
      </Tabs>
    </>
  );
}
