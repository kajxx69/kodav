import {
  ABIDJAN_COMMUNES,
  CLIENT_PROFILES,
  DIAGNOSTIC_MODES,
  DIAGNOSTIC_NEEDS,
  DIAGNOSTIC_URGENCIES,
  PROFILE_META,
  type ClientProfile,
  type DiagnosticInput,
  type DiagnosticResult,
  type Service,
} from '@kodav/shared';
import { useMutation } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { ServiceCard } from '~/components/site/ServiceCard';
import { Alert, Button, ChoiceCards, SelectField, Stepper } from '~/components/ui';
import { apiRequest } from '~/lib/api';
import { useProfileStore } from '~/stores/profile';

type Answers = Partial<DiagnosticInput>;

const COMMUNES = [...ABIDJAN_COMMUNES, 'Hors Abidjan'] as const;
const LABELS = ['Profil', 'Besoin', 'Délai', 'Lieu', 'Commune'] as const;

function quoteLink(result: DiagnosticResult) {
  const params = new URLSearchParams({
    services: result.recommendations.map((r) => r.serviceId).join(','),
    urgency: result.prefill.urgency,
    mode: result.prefill.mode,
    source: 'diagnostic',
  });
  if (result.prefill.commune) params.set('commune', result.prefill.commune);
  return `/devis?${params}`;
}

export function DiagnosticWizard({ services }: { services: Service[] }) {
  const rememberedProfile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const [answers, setAnswers] = useState<Answers>(() =>
    rememberedProfile ? { profile: rememberedProfile } : {},
  );
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const mutation = useMutation({
    mutationFn: (input: DiagnosticInput) =>
      apiRequest<DiagnosticResult>('/diagnostic/recommend', { method: 'POST', json: input }),
  });

  // La commune n'est demandée que si un déplacement est possible.
  const needsCommune = answers.mode !== 'distance';
  const lastStep = needsCommune ? 4 : 3;
  const labels = needsCommune ? LABELS : LABELS.slice(0, 4);

  const go = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const answer = (patch: Answers, advance = true) => {
    const merged = { ...answers, ...patch };
    setAnswers(merged);
    if (patch.profile) setProfile(patch.profile);
    if (!advance) return;
    const nextLast = merged.mode === 'distance' ? 3 : 4;
    if (step >= nextLast) submit(merged);
    else go(step + 1);
  };
  const submit = (input: Answers) => {
    mutation.mutate(input as DiagnosticInput);
    go(lastStep + 1);
  };
  const restart = () => {
    mutation.reset();
    setAnswers(answers.profile ? { profile: answers.profile } : {});
    go(0);
  };

  const needs = DIAGNOSTIC_NEEDS.filter(
    (n) => !n.profiles || !answers.profile || n.profiles.includes(answers.profile),
  );
  const byId = new Map(services.map((s) => [s.id, s]));
  const done = step > lastStep;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {!done && <Stepper steps={labels} current={step} />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={done ? 'result' : step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-6"
        >
          <h2 ref={headingRef} tabIndex={-1} className="text-h3 outline-none">
            {done
              ? 'Nos recommandations'
              : [
                  'Vous êtes…',
                  'De quoi avez-vous besoin ?',
                  'Quand faut-il intervenir ?',
                  'Comment préférez-vous être aidé ?',
                  'Dans quelle commune ?',
                ][step]}
          </h2>

          {step === 0 && (
            <ChoiceCards
              legend="Votre profil"
              hideLegend
              value={answers.profile}
              onChange={(profile: ClientProfile) => answer({ profile })}
              choices={CLIENT_PROFILES.map((p) => ({ value: p, label: PROFILE_META[p].plural }))}
            />
          )}
          {step === 1 && (
            <ChoiceCards
              legend="Votre besoin"
              hideLegend
              value={answers.need}
              onChange={(need) => answer({ need })}
              choices={needs.map((n) => ({ value: n.key, label: n.label }))}
            />
          )}
          {step === 2 && (
            <ChoiceCards
              legend="Délai"
              hideLegend
              columns={1}
              value={answers.urgency}
              onChange={(urgency) => answer({ urgency })}
              choices={DIAGNOSTIC_URGENCIES.map((u) => ({ value: u.key, label: u.label }))}
            />
          )}
          {step === 3 && (
            <ChoiceCards
              legend="Lieu d’intervention"
              hideLegend
              columns={1}
              value={answers.mode}
              onChange={(mode) => answer({ mode })}
              choices={DIAGNOSTIC_MODES.map((m) => ({ value: m.key, label: m.label }))}
            />
          )}
          {step === 4 && (
            <form
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (answers.commune) submit(answers);
              }}
            >
              <SelectField
                label="Commune"
                placeholder="Choisir…"
                containerClassName="flex-1"
                options={COMMUNES.map((c) => ({ value: c, label: c }))}
                value={answers.commune ?? ''}
                onChange={(e) =>
                  answer({ commune: (e.target.value || undefined) as Answers['commune'] }, false)
                }
              />
              <Button type="submit" variant="secondary" disabled={!answers.commune}>
                Voir les recommandations
              </Button>
            </form>
          )}

          {done && mutation.isPending && (
            <p role="status" className="text-body text-ink-muted">
              Analyse de vos réponses…
            </p>
          )}
          {done && mutation.isError && (
            <Alert
              variant="danger"
              action={
                <Button variant="outline" size="sm" onClick={() => submit(answers)}>
                  Réessayer
                </Button>
              }
            >
              {mutation.error.message}
            </Alert>
          )}
          {done && mutation.data && (
            <>
              <p className="text-body text-ink-muted">
                D’après vos réponses, voici les services les plus adaptés. Votre demande de devis
                est déjà pré-remplie.
              </p>
              <ul className="grid gap-4">
                {mutation.data.recommendations.map(({ serviceId, reason }, index) => {
                  const service = byId.get(serviceId);
                  if (!service) return null;
                  return (
                    <motion.li
                      key={serviceId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className="flex flex-col gap-2"
                    >
                      <ServiceCard service={service} />
                      <p className="px-1 text-body-sm text-ink-muted">{reason}</p>
                    </motion.li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to={quoteLink(mutation.data)}>Obtenir mon devis</Link>
                </Button>
                {(() => {
                  const first = byId.get(mutation.data.recommendations[0]?.serviceId ?? '');
                  return first ? (
                    <Button asChild size="lg" variant="outline">
                      <Link to={`/rendez-vous?service=${first.category.slug}/${first.slug}`}>
                        Réserver une intervention
                      </Link>
                    </Button>
                  ) : null;
                })()}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between gap-3">
        {step > 0 && !done ? (
          <Button variant="ghost" onClick={() => go(step - 1)}>
            Question précédente
          </Button>
        ) : (
          <span />
        )}
        {done && (
          <Button variant="ghost" onClick={restart}>
            <RotateCcw aria-hidden />
            Recommencer
          </Button>
        )}
      </div>
    </div>
  );
}
