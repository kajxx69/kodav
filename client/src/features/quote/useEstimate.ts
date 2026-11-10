import type { Estimate, EstimateInput } from '@kodav/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiRequest } from '~/lib/api';
import type { DraftState } from './draftStore';

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Estimation calculée par l'API à chaque changement (regroupés sur 300 ms). */
export function useEstimate(draft: Pick<DraftState, 'items' | 'urgency' | 'mode' | 'commune'>) {
  const input: EstimateInput = {
    items: draft.items,
    urgency: draft.urgency,
    mode: draft.mode,
    commune: draft.mode === 'sur_site' ? draft.commune : undefined,
  };
  const debounced = useDebounced(JSON.stringify(input), 300);
  // La valeur différée peut encore être l'ancienne (vide) : c'est elle qui décide de l'appel.
  const hasItems = (JSON.parse(debounced) as EstimateInput).items.length > 0;
  return useQuery({
    queryKey: ['pricing', 'estimate', debounced],
    queryFn: () =>
      apiRequest<Estimate>('/pricing/estimate', { method: 'POST', json: JSON.parse(debounced) }),
    enabled: hasItems && draft.items.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
