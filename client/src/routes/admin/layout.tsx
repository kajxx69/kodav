import { AppShell } from '~/components/app/AppShell';
import { adminNav } from '~/features/spaces/nav';
import { requireRole } from '~/lib/session';
import type { Route } from './+types/layout';

export const clientLoader = ({ request }: Route.ClientLoaderArgs) =>
  requireRole(request, ['admin']);

export const meta = () => [
  { title: 'Administration · KODAV' },
  { name: 'robots', content: 'noindex' },
];

export default function AdminSpaceLayout() {
  return <AppShell title="Administration" nav={adminNav} profilePath="/admin/profil" />;
}
