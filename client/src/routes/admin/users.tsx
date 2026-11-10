import {
  PROFILE_META,
  USER_ROLES,
  USER_ROLE_LABELS,
  type AuthUser,
  type Paginated,
  type UserRole,
  adminCreateUserSchema,
  type AdminCreateUserInput,
} from '@kodav/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Search, UserPlus } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { SpaceHeader } from '~/components/app/AppShell';
import {
  Alert,
  Badge,
  Button,
  Modal,
  toast,
  DataTable,
  ErrorState,
  SelectField,
  TextField,
  type Column,
} from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { applyServerErrors } from '~/lib/forms';
import { useAuthStore } from '~/stores/auth';

type AdminUser = AuthUser & { isActive: boolean };

const PAGE_SIZE = 20;
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

const columns: Column<AdminUser>[] = [
  {
    key: 'name',
    header: 'Nom',
    cell: (u) => (
      <span>
        <span className="block text-label">
          {u.firstName} {u.lastName}
        </span>
        <span className="block text-caption text-ink-muted">{u.email}</span>
      </span>
    ),
    sortValue: (u) => `${u.lastName} ${u.firstName}`,
  },
  {
    key: 'role',
    header: 'Rôle',
    cell: (u) => (
      <Badge variant={u.role === 'admin' ? 'info' : 'neutral'}>{USER_ROLE_LABELS[u.role]}</Badge>
    ),
    sortValue: (u) => u.role,
  },
  {
    key: 'profile',
    header: 'Profil',
    cell: (u) =>
      u.profile ? (
        <span>
          {PROFILE_META[u.profile].label}
          {u.organization && (
            <span className="block text-caption text-ink-muted">{u.organization.name}</span>
          )}
        </span>
      ) : (
        '—'
      ),
  },
  {
    key: 'status',
    header: 'Statut',
    cell: (u) =>
      !u.isActive ? (
        <Badge variant="danger">Désactivé</Badge>
      ) : u.emailVerified ? (
        <Badge variant="success">Actif</Badge>
      ) : (
        <Badge variant="warning">Email non confirmé</Badge>
      ),
  },
  {
    key: 'createdAt',
    header: 'Inscription',
    cell: (u) => dateFormat.format(new Date(u.createdAt)),
    sortValue: (u) => u.createdAt,
  },
  { key: 'actions', header: '', cell: (u) => <ActiveToggle user={u} /> },
];

const roleOptions = USER_ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }));

function NewMemberForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdminCreateUserInput, unknown, z.output<typeof adminCreateUserSchema>>({
    resolver: zodResolver(adminCreateUserSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', role: 'technicien' },
  });
  const create = useMutation({
    mutationFn: (v: z.output<typeof adminCreateUserSchema>) =>
      apiRequest('/admin/users', { method: 'POST', json: v }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'users'] });
      toast('Compte créé', {
        description: 'Un email l’invite à choisir son mot de passe.',
        variant: 'success',
      });
      onDone();
    },
    onError: (err) =>
      setFormError(
        applyServerErrors(err, setError, ['firstName', 'lastName', 'email', 'phone', 'role']),
      ),
  });
  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        create.mutate(v);
      })}
      className="grid gap-4 sm:grid-cols-2"
    >
      {formError && (
        <Alert variant="danger" className="sm:col-span-2">
          {formError}
        </Alert>
      )}
      <TextField
        label="Prénom"
        required
        error={errors.firstName?.message}
        {...register('firstName')}
      />
      <TextField label="Nom" required error={errors.lastName?.message} {...register('lastName')} />
      <TextField
        label="Email"
        type="email"
        required
        containerClassName="sm:col-span-2"
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label="Téléphone"
        type="tel"
        prefix="+225"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <SelectField
        label="Rôle"
        options={[
          { value: 'technicien', label: 'Technicien' },
          { value: 'admin', label: 'Administrateur' },
        ]}
        {...register('role')}
      />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" variant="secondary" loading={create.isPending}>
          Créer et inviter
        </Button>
      </div>
    </form>
  );
}

function ActiveToggle({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user?.id);
  const update = useMutation({
    mutationFn: () =>
      apiRequest(`/admin/users/${user.id}`, {
        method: 'PATCH',
        json: { isActive: !user.isActive },
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'users'] }),
    onError: (err) =>
      toast('Modification impossible', { description: err.message, variant: 'error' }),
  });
  if (user.id === me) return <span className="text-caption text-ink-muted">Vous</span>;
  return (
    <Button variant="ghost" size="sm" loading={update.isPending} onClick={() => update.mutate()}>
      {user.isActive ? 'Désactiver' : 'Réactiver'}
    </Button>
  );
}

export default function AdminUsers() {
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();
  const role = (USER_ROLES as readonly string[]).includes(params.get('role') ?? '')
    ? (params.get('role') as UserRole)
    : undefined;
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const update = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  };

  const query = useQuery({
    queryKey: ['private', 'admin', 'users', { role, q, page }],
    queryFn: () => {
      const search = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (role) search.set('role', role);
      if (q) search.set('q', q);
      return apiRequest<Paginated<AdminUser>>(`/admin/users?${search}`);
    },
    placeholderData: keepPreviousData,
  });
  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <SpaceHeader
        title="Utilisateurs"
        lead="Comptes clients, techniciens et administrateurs. Un compte désactivé est déconnecté immédiatement."
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus aria-hidden />
            Ajouter un membre de l’équipe
          </Button>
        }
      />
      <Modal
        open={creating}
        onOpenChange={setCreating}
        title="Nouveau membre de l’équipe"
        description="Il reçoit un email pour choisir son mot de passe."
      >
        {creating && <NewMemberForm onDone={() => setCreating(false)} />}
      </Modal>
      <form
        role="search"
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get('q');
          update({ q: String(value ?? '').trim() || undefined, page: undefined });
        }}
      >
        {/* Champ non contrôlé, réinitialisé quand la recherche change dans l'URL. */}
        <TextField
          key={q}
          name="q"
          label="Rechercher"
          type="search"
          placeholder="Nom ou email"
          defaultValue={q}
          containerClassName="flex-1"
        />
        <SelectField
          label="Rôle"
          options={roleOptions}
          placeholder="Tous"
          value={role ?? ''}
          onChange={(e) => update({ role: e.target.value || undefined, page: undefined })}
          containerClassName="sm:w-48"
        />
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          Rechercher
        </Button>
      </form>

      {query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable
          caption="Liste des utilisateurs"
          columns={columns}
          rows={query.data?.items}
          rowKey={(u) => u.id}
          loading={query.isPending}
          emptyTitle="Aucun utilisateur trouvé"
          emptyDescription="Modifiez la recherche ou le filtre de rôle."
        />
      )}

      {query.data && query.data.total > PAGE_SIZE && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <p className="text-body-sm text-ink-muted">
            Page {page} sur {totalPages} · {query.data.total} comptes
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => update({ page: String(page + 1) })}
            >
              Suivant
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}
