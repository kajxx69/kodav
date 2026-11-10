import {
  INTERVENTION_MODES,
  COMMUNE_CHOICES,
  type CategoryWithServices,
  type QuoteDraft,
  type QuoteDto,
  type Service,
} from '@kodav/shared';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert, Button, Stepper } from '~/components/ui';
import { ApiRequestError, apiRequest } from '~/lib/api';
import { queries } from '~/lib/queries';
import { useAuthStore } from '~/stores/auth';
import { ContactStep } from './ContactStep';
import {
  draftSnapshot,
  emptyDraft,
  parseDraft,
  readStoredDraft,
  useDraftStore,
  type DraftState,
} from './draftStore';
import { EstimateAside, EstimateBar } from './EstimateSummary';
import { useEstimate } from './useEstimate';
import { DetailsStep, InterventionStep, ServiceStep } from './steps';

const STEPS = ['Services', 'Détails', 'Intervention', 'Coordonnées'] as const;

/**
 * Pré-remplissage depuis l'URL : `?service=pole/slug` (fiche service), `?formule=pro`
 * (contrats) ou `?services=id,id&urgency=…&mode=…&commune=…` (Diagnostic Express).
 */
function draftFromUrl(params: URLSearchParams, catalog: CategoryWithServices[]): DraftState | null {
  const all = catalog.flatMap((c) => c.services);
  const ids: string[] = [];
  const single = params.get('service');
  if (single) {
    const [pole, slug] = single.split('/');
    const found = all.find((s) => s.category.slug === pole && s.slug === slug);
    if (found) ids.push(found.id);
  }
  for (const id of params.get('services')?.split(',') ?? []) {
    if (all.some((s) => s.id === id)) ids.push(id);
  }
  const plan = params.get('formule');
  if (plan) {
    const contract = all.find((s) => s.slug === 'contrat-de-maintenance');
    if (contract) ids.push(contract.id);
  }
  if (!ids.length) return null;
  const mode = params.get('mode');
  const commune = params.get('commune');
  return {
    ...emptyDraft,
    step: 1,
    items: [...new Set(ids)].map((serviceId) => ({ serviceId, quantity: 1, options: {} })),
    urgency: params.get('urgency') ?? 'standard',
    mode: (INTERVENTION_MODES as readonly string[]).includes(mode ?? '')
      ? (mode as DraftState['mode'])
      : 'sur_site',
    commune: (COMMUNE_CHOICES as readonly string[]).includes(commune ?? '')
      ? (commune as DraftState['commune'])
      : undefined,
    clientNotes: plan ? `Formule de maintenance souhaitée : ${plan}.` : '',
    source: params.get('source') === 'diagnostic' ? 'diagnostic' : 'configurateur',
  };
}

/** Brouillon serveur du client connecté : relu à l'ouverture, réécrit après chaque pause. */
function useServerDraftSync(enabled: boolean) {
  const changedAt = useDraftStore((s) => s.changedAt);
  useEffect(() => {
    if (!enabled || !changedAt) return;
    const id = setTimeout(() => {
      apiRequest('/quotes/draft', { method: 'PUT', json: draftSnapshot() }).catch(() => {
        // Le brouillon local reste la sauvegarde de secours.
      });
    }, 1500);
    return () => clearTimeout(id);
  }, [enabled, changedAt]);
}

function Success({ quote, onRestart }: { quote: QuoteDto; onRestart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      className="mx-auto flex max-w-2xl flex-col items-start gap-5 rounded-lg border border-line bg-surface-raised p-6 shadow-sm sm:p-8"
    >
      <CircleCheck className="size-10 text-success" aria-hidden />
      <div>
        <h2 className="text-h2">Demande envoyée</h2>
        <p className="mt-2 text-body text-ink-muted">
          Votre référence : <strong className="text-ink">{quote.reference}</strong>. Le
          récapitulatif en PDF vient de partir à {quote.contact.email}. Notre équipe étudie votre
          demande et vous envoie un devis définitif rapidement.
        </p>
      </div>
      {quote.hasAccount ? (
        <Button asChild>
          <Link to={`/espace-client/devis/${quote.id}`}>Suivre ma demande</Link>
        </Button>
      ) : (
        <Alert
          variant="info"
          title="Suivez votre demande en ligne"
          action={
            <Button asChild>
              <Link to="/inscription">Créer mon compte</Link>
            </Button>
          }
        >
          Créez votre compte avec l’adresse {quote.contact.email} : cette demande y sera rattachée
          dès la confirmation de votre email.
        </Alert>
      )}
      <Button variant="ghost" onClick={onRestart}>
        Faire une autre demande
      </Button>
    </motion.div>
  );
}

export function Configurator({ catalog }: { catalog: CategoryWithServices[] }) {
  const [params, setParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isClient = user?.role === 'client';
  const draft = useDraftStore();
  const [submitted, setSubmitted] = useState<QuoteDto | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rules = useQuery(queries.pricingRules());

  // Ouverture : lien entrant prioritaire, sinon brouillon serveur (client) ou local.
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current || !catalog.length) return;
    initialised.current = true;
    const fromUrl = draftFromUrl(params, catalog);
    if (fromUrl) {
      useDraftStore.getState().replace(fromUrl);
      setParams({}, { replace: true });
      return;
    }
    const local = readStoredDraft();
    if (local) useDraftStore.getState().replace(local);
    if (isClient && !local?.items.length) {
      apiRequest<QuoteDraft | null>('/quotes/draft')
        .then((server) => {
          const parsed = parseDraft(server);
          if (parsed?.items.length) useDraftStore.getState().replace(parsed);
        })
        .catch(() => undefined);
    }
  }, [catalog, params, setParams, isClient]);
  useServerDraftSync(isClient);

  const services = useMemo(
    () => new Map<string, Service>(catalog.flatMap((c) => c.services).map((s) => [s.id, s])),
    [catalog],
  );
  // Un service retiré du catalogue depuis la création du brouillon est ignoré.
  const items = draft.items.filter((i) => services.has(i.serviceId));
  const estimate = useEstimate({ ...draft, items });
  const selected = items.map((i) => services.get(i.serviceId)!);

  const goTo = (step: number) => {
    draft.update({ step });
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  if (submitted) {
    return (
      <Success
        quote={submitted}
        onRestart={() => {
          setSubmitted(null);
          useDraftStore.getState().reset();
        }}
      />
    );
  }

  const step = items.length ? draft.step : 0;
  const canContinue =
    step === 0
      ? items.length > 0
      : step === 2
        ? draft.mode !== 'sur_site' || Boolean(draft.commune)
        : true;
  const estimateError =
    estimate.error instanceof ApiRequestError
      ? estimate.error.message
      : estimate.error
        ? 'Estimation indisponible'
        : null;
  const summaryProps = {
    estimate: items.length ? estimate.data : undefined,
    loading: estimate.isFetching,
    error: estimateError,
    empty: items.length === 0,
  };

  return (
    <div className="grid gap-8 pb-28 lg:grid-cols-[minmax(0,1fr)_22rem] lg:pb-0">
      <div className="flex min-w-0 flex-col gap-6">
        <Stepper steps={STEPS} current={step} />
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-24 text-h3 outline-none">
          {step + 1}. {STEPS[step]}
        </h2>
        {step === 0 && <ServiceStep catalog={catalog} />}
        {step === 1 && <DetailsStep services={services} />}
        {step === 2 && <InterventionStep services={selected} rules={rules.data} />}
        {step === 3 && <ContactStep onSubmitted={setSubmitted} onBack={() => goTo(2)} />}

        {step < 3 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            {step > 0 ? (
              <Button variant="outline" onClick={() => goTo(step - 1)}>
                Retour
              </Button>
            ) : (
              <span className="text-body-sm text-ink-muted">
                {items.length
                  ? `${items.length} service${items.length > 1 ? 's' : ''} sélectionné${items.length > 1 ? 's' : ''}`
                  : 'Aucun service sélectionné'}
              </span>
            )}
            <Button variant="secondary" disabled={!canContinue} onClick={() => goTo(step + 1)}>
              Continuer
            </Button>
          </div>
        )}
        {step === 2 && !canContinue && (
          <p className="text-body-sm text-ink-muted">Indiquez la commune pour continuer.</p>
        )}
      </div>
      <div>
        <EstimateAside {...summaryProps} />
      </div>
      <EstimateBar {...summaryProps} />
    </div>
  );
}
