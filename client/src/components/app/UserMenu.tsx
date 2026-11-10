import { USER_ROLE_LABELS } from '@kodav/shared';
import { ChevronDown, ExternalLink, LogOut, UserRound } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { Link, useNavigate } from 'react-router';
import { toast } from '~/components/ui';
import { logoutRequest } from '~/lib/api';
import { clearPrivateCache } from '~/lib/session';
import { useAuthStore } from '~/stores/auth';

const itemClass =
  'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-body-sm text-ink outline-none data-[highlighted]:bg-surface-sunken [&_svg]:size-4 [&_svg]:text-ink-muted';

export function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function useLogout() {
  const navigate = useNavigate();
  return async () => {
    try {
      await logoutRequest();
    } catch {
      toast('Déconnexion locale', {
        description: 'Le serveur est injoignable ; la session a été fermée sur cet appareil.',
      });
    }
    clearPrivateCache();
    navigate('/connexion', { replace: true });
  };
}

export function UserMenu({ profilePath }: { profilePath: string }) {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  if (!user) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-surface-sunken data-[state=open]:bg-surface-sunken">
        <span
          className="grid size-9 place-items-center rounded-full bg-secondary text-label text-on-secondary"
          aria-hidden
        >
          {initials(user.firstName, user.lastName)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-label text-ink">{user.firstName}</span>
          <span className="block text-caption text-ink-muted">{USER_ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDown className="size-4 text-ink-muted" aria-hidden />
        <span className="sr-only">Menu du compte</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-lg border border-line bg-surface-raised p-1 shadow-lg data-[state=open]:animate-[fade-in_120ms_ease-out]"
        >
          <div className="px-3 py-2">
            <p className="text-label text-ink">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-caption text-ink-muted">{user.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={itemClass}>
            <Link to={profilePath}>
              <UserRound aria-hidden />
              Mon profil
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link to="/">
              <ExternalLink aria-hidden />
              Retour au site
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={itemClass} onSelect={() => void logout()}>
            <LogOut aria-hidden />
            Se déconnecter
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
