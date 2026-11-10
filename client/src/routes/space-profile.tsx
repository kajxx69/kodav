import { SpaceHeader } from '~/components/app/AppShell';
import { ProfileSettings } from '~/features/spaces/ProfileSettings';

export default function SpaceProfile() {
  return (
    <>
      <SpaceHeader title="Profil" lead="Vos coordonnées, votre mot de passe et vos préférences." />
      <ProfileSettings />
    </>
  );
}
