import { AppShell } from '~/components/app/AppShell';
import { technicianNav } from '~/features/spaces/nav';
import { requireRole } from '~/lib/session';
import type { Route } from './+types/layout';

// L'admin peut consulter l'espace technicien (dépannage, démonstration).
export const clientLoader = ({ request }: Route.ClientLoaderArgs) =>
  requireRole(request, ['technicien', 'admin']);

export const meta = () => [
  { title: 'Espace technicien · KODAV' },
  { name: 'robots', content: 'noindex' },
];

export default function TechnicianSpaceLayout() {
  return (
    <AppShell
      title="Espace technicien"
      nav={technicianNav}
      profilePath="/technicien/profil"
      bottomNav
    />
  );
}
