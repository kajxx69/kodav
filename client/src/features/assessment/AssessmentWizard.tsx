import { zodResolver } from '@hookform/resolvers/zod';
import {
  ASSESSMENT_LEVELS,
  ASSESSMENT_QUESTIONS,
  ASSESSMENT_SEATS,
  ASSESSMENT_SEAT_LABELS,
  CLIENT_PROFILES,
  PROFILE_META,
  assessmentInputSchema,
  scoreAssessment,
  type AssessmentAnswers,
  type AssessmentLevel,
  type ClientProfile,
  type Service,
} from '@kodav/shared';
import { useMutation } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, RotateCcw, ShieldAlert, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';
import { ScoreGauge } from '~/components/site/ScoreGauge';
import { Button, Card, Checkbox, ChoiceCards, TextField, toast } from '~/components/ui';
import { ApiRequestError, apiRequest } from '~/lib/api';
import { useProfileStore } from '~/stores/profile';

type Seats = (typeof ASSESSMENT_SEATS)[number];

const LEVEL_STYLE: Record<AssessmentLevel, { color: string; icon: LucideIcon; text: string }> = {
  bon: { color: 'var(--color-success)', icon: CircleCheck, text: 'text-success' },
  moyen: { color: 'var(--color-warning)', icon: CircleAlert, text: 'text-warning' },
  faible: { color: 'var(--color-danger)', icon: ShieldAlert, text: 'text-danger' },
};

const contactSchema = assessmentInputSchema.pick({
  name: true,
  email: true,
  phone: true,
  company: true,
  consent: true,
  website: true,
});
type ContactValues = z.input<typeof contactSchema>;
type ContactOutput = z.output<typeof contactSchema>;

const TOTAL = ASSESSMENT_QUESTIONS.length;

/** Étape 0 : profil et taille du parc ; étapes 1 à 12 : une question par écran ; puis résultat. */
export function AssessmentWizard({ services }: { services: Service[] }) {
  const rememberedProfile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const [profile, setLocalProfile] = useState<ClientProfile | undefined>(
    rememberedProfile ?? undefined,
  );
  const [seats, setSeats] = useState<Seats>();
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [step, setStep] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();

  const go = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  const done = step > TOTAL;
  const question = step >= 1 && step <= TOTAL ? ASSESSMENT_QUESTIONS[step - 1]! : null;
  const result = done ? scoreAssessment(answers) : null;
  const bySlug = new Map(services.map((s) => [s.slug, s]));

  const restart = () => {
    setAnswers({});
    go(1);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {!done && (
        <div className="flex flex-col gap-2">
          <p className="text-caption text-ink-muted" aria-live="polite">
            {step === 0 ? 'Avant de commencer' : `Question ${step} sur ${TOTAL}`}
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-sunken"
            role="progressbar"
            aria-label="Avancement du bilan"
            aria-valuemin={0}
            aria-valuemax={TOTAL}
            aria-valuenow={step}
          >
            <div
              className="h-full rounded-full bg-secondary transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${(step / TOTAL) * 100}%` }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={done ? 'result' : step}
          initial={reduced ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-6"
        >
          {step === 0 && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="text-h3 outline-none">
                Votre structure
              </h2>
              <ChoiceCards
                legend="Vous êtes"
                value={profile}
                onChange={(p: ClientProfile) => {
                  setLocalProfile(p);
                  setProfile(p);
                }}
                choices={CLIENT_PROFILES.map((p) => ({ value: p, label: PROFILE_META[p].label }))}
              />
              <ChoiceCards
                legend="Nombre de postes informatiques"
                value={seats}
                onChange={(s: Seats) => setSeats(s)}
                choices={ASSESSMENT_SEATS.map((s) => ({
                  value: s,
                  label: ASSESSMENT_SEAT_LABELS[s],
                }))}
              />
              <Button
                variant="secondary"
                className="self-start"
                disabled={!profile || !seats}
                onClick={() => go(1)}
              >
                Commencer le bilan
              </Button>
            </>
          )}

          {question && (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-overline text-ink-muted">{question.theme}</p>
                <h2 ref={headingRef} tabIndex={-1} className="text-h3 outline-none">
                  {question.label}
                </h2>
              </div>
              <ChoiceCards
                legend={question.label}
                hideLegend
                columns={1}
                value={answers[question.key]}
                onChange={(value) => {
                  setAnswers((a) => ({ ...a, [question.key]: value }));
                  go(step + 1);
                }}
                choices={question.options.map((o) => ({ value: o.value, label: o.label }))}
              />
            </>
          )}

          {result && profile && seats && (
            <>
              <h2 ref={headingRef} tabIndex={-1} className="text-h3 outline-none">
                Votre résultat
              </h2>
              <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="w-full sm:w-64">
                  <ScoreGauge
                    score={result.score}
                    color={LEVEL_STYLE[result.level].color}
                    label={ASSESSMENT_LEVELS[result.level].label}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <p
                    className={`flex items-center justify-center gap-2 text-h4 sm:justify-start ${LEVEL_STYLE[result.level].text}`}
                  >
                    {(() => {
                      const Icon = LEVEL_STYLE[result.level].icon;
                      return <Icon className="size-5" aria-hidden />;
                    })()}
                    {ASSESSMENT_LEVELS[result.level].label}
                  </p>
                  <p className="text-body text-ink">{ASSESSMENT_LEVELS[result.level].summary}</p>
                </div>
              </Card>

              {result.weaknesses.length > 0 ? (
                <section className="flex flex-col gap-3" aria-labelledby="weak-title">
                  <h3 id="weak-title" className="text-h4">
                    Vos points les plus urgents
                  </h3>
                  <ol className="flex flex-col gap-3">
                    {result.weaknesses.slice(0, 3).map((w, i) => {
                      const service = bySlug.get(w.serviceSlug);
                      return (
                        <motion.li
                          key={w.key}
                          initial={reduced ? false : { opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                        >
                          <Card className="flex flex-col gap-2">
                            <p className="text-label text-ink">
                              {i + 1}. {w.theme}
                            </p>
                            <p className="text-body-sm text-ink-muted">{w.weakness}</p>
                            <p className="text-body-sm text-ink">{w.recommendation}</p>
                            {service && (
                              <Link
                                to={`/services/${service.category.slug}/${service.slug}`}
                                className="self-start text-label text-link underline"
                              >
                                Découvrir : {service.name}
                              </Link>
                            )}
                          </Card>
                        </motion.li>
                      );
                    })}
                  </ol>
                  {result.weaknesses.length > 3 && (
                    <p className="text-body-sm text-ink-muted">
                      Et {result.weaknesses.length - 3} autre
                      {result.weaknesses.length - 3 > 1 ? 's' : ''} point
                      {result.weaknesses.length - 3 > 1 ? 's' : ''} détaillé
                      {result.weaknesses.length - 3 > 1 ? 's' : ''} dans le rapport complet.
                    </p>
                  )}
                </section>
              ) : (
                <p className="text-body text-ink">
                  Aucun point faible relevé dans vos réponses. Le rapport complet reprend le détail
                  de chaque thème.
                </p>
              )}

              <ReportForm profile={profile} seats={seats} answers={answers} />
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
            Refaire le bilan
          </Button>
        )}
      </div>
    </div>
  );
}

/** Rapport détaillé envoyé par email en échange des coordonnées. */
function ReportForm({
  profile,
  seats,
  answers,
}: {
  profile: ClientProfile;
  seats: Seats;
  answers: AssessmentAnswers;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ContactValues, unknown, ContactOutput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { website: '' },
  });
  const mutation = useMutation({
    mutationFn: (input: ContactOutput) =>
      apiRequest('/assessments', { method: 'POST', json: { ...input, profile, seats, answers } }),
    onError: (error) => {
      if (error instanceof ApiRequestError && error.details) {
        for (const d of error.details)
          setError(d.path as keyof ContactValues, { message: d.message });
        return;
      }
      toast('Envoi impossible', { description: error.message, variant: 'error' });
    },
  });

  if (mutation.isSuccess) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-lg bg-success-soft p-6">
        <CircleCheck className="size-8 text-success" aria-hidden />
        <h3 className="text-h4">Rapport envoyé</h3>
        <p className="text-body text-ink">
          Vous allez recevoir votre rapport détaillé par email dans quelques minutes. Un conseiller
          peut vous rappeler pour en parler, sans engagement.
        </p>
        <Button asChild variant="secondary">
          <Link to="/devis">Demander un devis</Link>
        </Button>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-h4">Recevoir le rapport détaillé</h3>
        <p className="text-body-sm text-ink-muted">
          Tous vos points d’amélioration, classés par urgence, avec nos recommandations, en PDF par
          email. Gratuit et sans engagement.
        </p>
      </div>
      <form
        noValidate
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="grid gap-5 sm:grid-cols-2"
      >
        <TextField
          label="Nom et prénom"
          autoComplete="name"
          required
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Entreprise ou établissement"
          autoComplete="organization"
          error={errors.company?.message}
          {...register('company')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          error={errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Téléphone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          prefix="+225"
          placeholder="07 07 00 00 00"
          help="10 chiffres"
          required
          error={errors.phone?.message}
          {...register('phone')}
        />
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Site web
            <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
          </label>
        </div>
        <Checkbox
          className="sm:col-span-2"
          label="J’accepte que KODAV Technologies utilise ces informations pour m’envoyer le rapport et me recontacter."
          error={errors.consent?.message}
          {...register('consent')}
        />
        <Button
          type="submit"
          size="lg"
          className="sm:col-span-2 sm:justify-self-start"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Envoi…' : 'Recevoir mon rapport'}
        </Button>
      </form>
    </Card>
  );
}
