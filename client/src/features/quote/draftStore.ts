import { COMMUNE_CHOICES, INTERVENTION_MODES, type QuoteDraft } from '@kodav/shared';
import { create } from 'zustand';
import { safeStorage } from '~/lib/storage';

const STORAGE_KEY = 'kodav:quote-draft';

export type DraftItem = QuoteDraft['items'][number] & {
  quantity: number;
  options: Record<string, boolean | string | number>;
};

export type DraftState = {
  step: number;
  items: DraftItem[];
  urgency: string;
  mode: QuoteDraft['mode'];
  commune?: QuoteDraft['commune'];
  address: string;
  clientNotes: string;
  source: QuoteDraft['source'];
};

export const emptyDraft: DraftState = {
  step: 0,
  items: [],
  urgency: 'standard',
  mode: 'sur_site',
  commune: undefined,
  address: '',
  clientNotes: '',
  source: 'configurateur',
};

/** Brouillon relu du stockage local : chaque champ est revérifié (données modifiables). */
export function parseDraft(raw: unknown): DraftState | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<DraftState>;
  const items = Array.isArray(d.items)
    ? d.items
        .filter((i) => typeof i?.serviceId === 'string')
        .slice(0, 15)
        .map((i) => ({
          serviceId: i.serviceId,
          quantity: Number.isInteger(i.quantity) && i.quantity > 0 ? i.quantity : 1,
          options: i.options && typeof i.options === 'object' ? i.options : {},
        }))
    : [];
  return {
    step: Number.isInteger(d.step) ? Math.min(Math.max(d.step!, 0), 3) : 0,
    items,
    urgency: typeof d.urgency === 'string' ? d.urgency : 'standard',
    mode: (INTERVENTION_MODES as readonly string[]).includes(d.mode ?? '') ? d.mode! : 'sur_site',
    commune: (COMMUNE_CHOICES as readonly string[]).includes(d.commune ?? '')
      ? d.commune
      : undefined,
    address: typeof d.address === 'string' ? d.address : '',
    clientNotes: typeof d.clientNotes === 'string' ? d.clientNotes : '',
    source: d.source === 'diagnostic' ? 'diagnostic' : 'configurateur',
  };
}

type DraftStore = DraftState & {
  /** Date de la dernière modification : déclenche la sauvegarde serveur (client connecté). */
  changedAt: number;
  update: (patch: Partial<DraftState>) => void;
  toggleService: (serviceId: string) => void;
  updateItem: (serviceId: string, patch: Partial<DraftItem>) => void;
  replace: (draft: DraftState) => void;
  reset: () => void;
};

function persist(state: DraftState) {
  safeStorage.set(STORAGE_KEY, JSON.stringify(state));
}

export function readStoredDraft() {
  try {
    return parseDraft(JSON.parse(safeStorage.get(STORAGE_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

function snapshot(s: DraftStore): DraftState {
  const { step, items, urgency, mode, commune, address, clientNotes, source } = s;
  return { step, items, urgency, mode, commune, address, clientNotes, source };
}

/** Configurateur de devis : brouillon sauvegardé automatiquement dans le navigateur. */
export const useDraftStore = create<DraftStore>((set, get) => {
  const commit = (patch: Partial<DraftState>) => {
    set({ ...patch, changedAt: Date.now() });
    persist(snapshot(get()));
  };
  return {
    ...emptyDraft,
    changedAt: 0,
    update: commit,
    toggleService(serviceId) {
      const { items } = get();
      commit({
        items: items.some((i) => i.serviceId === serviceId)
          ? items.filter((i) => i.serviceId !== serviceId)
          : [...items, { serviceId, quantity: 1, options: {} }],
      });
    },
    updateItem(serviceId, patch) {
      commit({
        items: get().items.map((i) => (i.serviceId === serviceId ? { ...i, ...patch } : i)),
      });
    },
    replace(draft) {
      set({ ...draft, changedAt: 0 });
      persist(draft);
    },
    reset() {
      safeStorage.remove(STORAGE_KEY);
      set({ ...emptyDraft, changedAt: 0 });
    },
  };
});

export const draftSnapshot = () => snapshot(useDraftStore.getState());
