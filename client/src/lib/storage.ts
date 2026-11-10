/** localStorage peut être absent ou lever une exception (navigation privée, stockage bloqué). */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Préférence non mémorisée : sans conséquence.
    }
  },
  remove(key: string) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // idem
    }
  },
};
