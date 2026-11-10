import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** false pendant le pré-rendu et la première hydratation, true ensuite. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
