import { AppShell } from '~/components/app/AppShell';
import { clientNav } from '~/features/spaces/nav';
import { requireRole } from '~/lib/session';
import type { Route } from './+types/layout';

export const clientLoader = ({ request }: Route.ClientLoaderArgs) =>
  requireRole(request, ['client']);

export const meta = () => [
  { title: 'Espace client · KODAV' },
  { name: 'robots', content: 'noindex' },
];

export default function ClientSpaceLayout() {
  return <AppShell title="Espace client" nav={clientNav} profilePath="/espace-client/profil" />;
}
