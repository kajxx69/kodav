import type { CategoryWithServices, PublicSettings } from '@kodav/shared';
import { useRouteLoaderData } from 'react-router';
import { useLiveQuery } from './loaderData';
import { queries } from './queries';

export type Pole = Pick<CategoryWithServices, 'slug' | 'name' | 'shortDescription' | 'icon'>;
export type RootData = { settings: PublicSettings | null; poles: Pole[] | null };

function useRootData() {
  return useRouteLoaderData('root') as RootData | undefined;
}

/** Identité de l'entreprise (§0), modifiable dans l'admin : jamais écrite en dur. */
export function useSettings() {
  return useLiveQuery(queries.settings(), useRootData()?.settings);
}

export function useBrand() {
  return useSettings().data?.brand;
}

/** Les 4 pôles pour la navigation (header, pied de page). */
export function usePoles(): Pole[] {
  const buildPoles = useRootData()?.poles;
  const { data } = useLiveQuery(queries.categories(), null);
  return (
    data?.map(({ slug, name, shortDescription, icon }) => ({
      slug,
      name,
      shortDescription,
      icon,
    })) ??
    buildPoles ??
    []
  );
}
