import { create } from 'zustand';
import { CLIENT_PROFILES, type ClientProfile } from '@kodav/shared';
import { safeStorage } from '~/lib/storage';

const STORAGE_KEY = 'kodav:profile';

type ProfileState = {
  /** null tant que le visiteur n'a rien choisi : contenu générique. */
  profile: ClientProfile | null;
  setProfile: (profile: ClientProfile | null) => void;
  hydrate: () => void;
};

/** Profil « Je suis… » : mémorisé pour réorganiser l'accueil et pré-remplir les formulaires. */
export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  setProfile(profile) {
    if (profile) safeStorage.set(STORAGE_KEY, profile);
    else safeStorage.remove(STORAGE_KEY);
    set({ profile });
  },
  hydrate() {
    const stored = safeStorage.get(STORAGE_KEY);
    if (stored && (CLIENT_PROFILES as readonly string[]).includes(stored)) {
      set({ profile: stored as ClientProfile });
    }
  },
}));
