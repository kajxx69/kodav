import { CLIENT_PROFILES, PROFILE_META, ROLE_HOME } from '@kodav/shared';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarCheck,
  FileText,
  HelpCircle,
  LayoutGrid,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { overlayClass } from '~/components/ui/Modal';
import { cn } from '~/lib/cn';
import { queries } from '~/lib/queries';
import { create } from 'zustand';
import { useAuthStore } from '~/stores/auth';

type Group = 'Actions' | 'Pages' | 'Services' | 'Questions fréquentes';
type Item = {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  to: string;
  keywords?: string;
  icon: LucideIcon;
};

const GROUP_ORDER: Group[] = ['Actions', 'Services', 'Pages', 'Questions fréquentes'];
const PER_GROUP = 6;

/** État d'ouverture partagé : le raccourci clavier et le bouton du header ouvrent la même palette. */
export const useCommandPalette = create<{ open: boolean; setOpen: (open: boolean) => void }>(
  (set) => ({ open: false, setOpen: (open) => set({ open }) }),
);

const ACTIONS: Omit<Item, 'group' | 'icon'>[] = [
  { id: 'devis', label: 'Demander un devis', to: '/devis', keywords: 'prix tarif estimation' },
  {
    id: 'rdv',
    label: 'Réserver une intervention',
    to: '/rendez-vous',
    keywords: 'rendez-vous technicien depannage',
  },
  { id: 'suivi', label: 'Suivre ma demande', to: '/suivi', keywords: 'reference suivi statut' },
  {
    id: 'bilan',
    label: 'Faire le bilan de santé informatique',
    to: '/bilan-informatique',
    keywords: 'audit securite score',
  },
  {
    id: 'diagnostic',
    label: 'Diagnostic express',
    to: '/diagnostic',
    keywords: 'conseil besoin recommandation',
  },
  { id: 'contact', label: 'Nous contacter', to: '/contact', keywords: 'message telephone email' },
];

const PAGES: Omit<Item, 'group' | 'icon'>[] = [
  { id: 'accueil', label: 'Accueil', to: '/' },
  { id: 'services', label: 'Tous les services', to: '/services' },
  {
    id: 'contrats',
    label: 'Contrats de maintenance',
    to: '/contrats-maintenance',
    keywords: 'formule abonnement comparateur',
  },
  { id: 'realisations', label: 'Réalisations', to: '/realisations', keywords: 'projets' },
  { id: 'a-propos', label: 'À propos', to: '/a-propos', keywords: 'equipe entreprise' },
  { id: 'faq', label: 'Questions fréquentes', to: '/faq' },
  ...CLIENT_PROFILES.map((p) => ({
    id: `solutions-${p}`,
    label: `Solutions pour les ${PROFILE_META[p].plural.toLowerCase()}`,
    to: `/solutions/${PROFILE_META[p].solutionSlug}`,
  })),
  { id: 'mentions', label: 'Mentions légales', to: '/mentions-legales' },
  { id: 'confidentialite', label: 'Politique de confidentialité', to: '/confidentialite' },
  { id: 'cgv', label: 'Conditions générales de vente', to: '/cgv' },
];

/** « Réseau Wi-Fi » et « reseau wifi » se trouvent l'un l'autre. */
export const normalize = (v: string) =>
  v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .toLowerCase()
    .trim();

export function matches(item: Pick<Item, 'label' | 'hint' | 'keywords'>, query: string) {
  const text = normalize(`${item.label} ${item.hint ?? ''} ${item.keywords ?? ''}`);
  // Version sans espaces en plus : « wifi » trouve « Wi-Fi », « email » trouve « e-mail ».
  const haystack = `${text} ${text.replace(/ /g, '')}`;
  return normalize(query)
    .split(' ')
    .every((word) => haystack.includes(word));
}

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();

  // Ctrl+K (Windows, Linux) ou Cmd+K (macOS), depuis n'importe quelle page publique.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useCommandPalette.getState().open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  // Catalogue et FAQ chargés seulement à la première ouverture (souvent déjà en cache).
  const categories = useQuery({ ...queries.categories(), enabled: open });
  const faqs = useQuery({ ...queries.faqs(), enabled: open });

  const items = useMemo<Item[]>(() => {
    const account = role
      ? { id: 'espace', label: 'Mon espace', to: ROLE_HOME[role] }
      : { id: 'connexion', label: 'Se connecter', to: '/connexion', keywords: 'compte espace' };
    return [
      ...[...ACTIONS, account].map((a) => ({
        ...a,
        group: 'Actions' as const,
        icon: a.id === 'rdv' ? CalendarCheck : a.id === 'devis' ? FileText : ArrowRight,
      })),
      ...(categories.data ?? []).flatMap((c) =>
        c.services.map((s) => ({
          id: `service-${s.id}`,
          group: 'Services' as const,
          label: s.name,
          hint: c.name,
          to: `/services/${c.slug}/${s.slug}`,
          keywords: s.shortDescription,
          icon: LayoutGrid,
        })),
      ),
      ...PAGES.map((p) => ({ ...p, group: 'Pages' as const, icon: ArrowRight })),
      ...(faqs.data ?? []).map((f) => ({
        id: `faq-${f.id}`,
        group: 'Questions fréquentes' as const,
        label: f.question,
        to: `/faq?question=${f.id}`,
        keywords: f.answer.slice(0, 200),
        icon: HelpCircle,
      })),
    ];
  }, [categories.data, faqs.data, role]);

  const groups = useMemo(() => {
    const q = query.trim();
    return GROUP_ORDER.map((group) => {
      const inGroup = items.filter((i) => i.group === group && (!q || matches(i, q)));
      // Sans recherche : actions et pages seulement, pour une liste courte.
      const shown = q ? inGroup.slice(0, PER_GROUP) : group === 'Actions' ? inGroup : [];
      return { group, items: shown };
    }).filter((g) => g.items.length);
  }, [items, query]);
  const flat = groups.flatMap((g) => g.items);
  const current = flat[Math.min(active, flat.length - 1)];

  useEffect(() => {
    if (!current) return;
    document.getElementById(`${listId}-${current.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [current, listId]);

  const go = (item: Item) => {
    setOpen(false);
    setQuery('');
    void navigate(item.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!flat.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(flat.length - 1);
    } else if (e.key === 'Enter' && current) {
      e.preventDefault();
      go(current);
    }
  };

  const loading = query.trim() && (categories.isPending || faqs.isPending);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[10vh] left-1/2 z-50 flex max-h-[min(32rem,80dvh)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-line bg-surface-raised shadow-lg data-[state=open]:animate-[fade-in_150ms_ease-out]"
        >
          <Dialog.Title className="sr-only">Rechercher sur le site</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-5 shrink-0 text-ink-muted" aria-hidden />
            <input
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls={listId}
              aria-activedescendant={current ? `${listId}-${current.id}` : undefined}
              aria-autocomplete="list"
              aria-label="Rechercher un service, une page, une question"
              placeholder="Rechercher un service, une page, une question…"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-14 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
            />
            <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-caption text-ink-muted sm:inline">
              Échap
            </kbd>
          </div>
          <ul id={listId} role="listbox" className="flex-1 overflow-y-auto p-2">
            {groups.map((g) => (
              <li key={g.group} role="presentation">
                <p
                  className="px-3 pt-3 pb-1 text-overline text-ink-muted"
                  role="presentation"
                  aria-hidden
                >
                  {g.group}
                </p>
                <ul role="group" aria-label={g.group}>
                  {g.items.map((item) => {
                    const selected = item === current;
                    const Icon = item.icon;
                    return (
                      <li
                        key={item.id}
                        id={`${listId}-${item.id}`}
                        role="option"
                        aria-selected={selected}
                        onMouseMove={() => setActive(flat.indexOf(item))}
                        onClick={() => go(item)}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-body-sm',
                          selected ? 'bg-surface-sunken text-ink' : 'text-ink',
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.hint && (
                          <span className="hidden shrink-0 text-caption text-ink-muted sm:inline">
                            {item.hint}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          {!flat.length && (
            <p role="status" className="px-5 pb-6 text-body-sm text-ink-muted">
              {loading ? 'Recherche…' : `Aucun résultat pour « ${query.trim()} ».`}
            </p>
          )}
          <p className="hidden border-t border-line px-4 py-2 text-caption text-ink-muted sm:block">
            ↑ ↓ pour naviguer · Entrée pour ouvrir
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
