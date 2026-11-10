import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        // Inutile de réessayer une 404 ou une erreur de validation.
        retry: (count, error) =>
          count < 2 &&
          !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500),
      },
    },
  });
}

/** Instance unique côté navigateur, partagée par les clientLoaders et les composants. */
export const queryClient = createQueryClient();
