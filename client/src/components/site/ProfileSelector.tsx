import { Building2, GraduationCap, Landmark, User, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { CLIENT_PROFILES, PROFILE_META, type ClientProfile } from '@kodav/shared';
import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '~/lib/cn';
import { useProfileStore } from '~/stores/profile';

const icons: Record<ClientProfile, LucideIcon> = {
  particulier: User,
  pme: Building2,
  ecole: GraduationCap,
  grande_entreprise: Landmark,
};

/**
 * Sélecteur « Je suis… » : groupe de boutons radio (flèches du clavier comprises).
 * La pastille or glisse d'un choix à l'autre.
 */
export function ProfileSelector({
  onBand = false,
  className,
}: {
  onBand?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + CLIENT_PROFILES.length) % CLIENT_PROFILES.length;
    setProfile(CLIENT_PROFILES[next]!);
    refs.current[next]?.focus();
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <p
        id="profile-selector-label"
        className={cn('text-label', onBand ? 'text-on-band-muted' : 'text-ink-muted')}
      >
        {t('profile.question')}
      </p>
      <div
        role="radiogroup"
        aria-labelledby="profile-selector-label"
        className={cn(
          'inline-flex flex-wrap gap-1 rounded-[20px] p-1 sm:rounded-full',
          onBand ? 'bg-navy/60 ring-1 ring-slate' : 'bg-surface-sunken',
        )}
      >
        {CLIENT_PROFILES.map((key, index) => {
          const Icon = icons[key];
          const checked = profile === key;
          // Sans choix, le premier bouton reste atteignable au clavier.
          const tabbable = checked || (profile === null && index === 0);
          return (
            <button
              key={key}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={tabbable ? 0 : -1}
              onClick={() => setProfile(key)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                'relative inline-flex h-10 items-center gap-2 rounded-full px-4 text-label transition-colors',
                checked
                  ? 'text-on-gold'
                  : onBand
                    ? 'text-on-band hover:bg-slate'
                    : 'text-ink hover:bg-surface-raised',
              )}
            >
              {checked && (
                <motion.span
                  layoutId="profile-pill"
                  className="absolute inset-0 rounded-full bg-gold"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className="relative size-4" aria-hidden />
              <span className="relative">{PROFILE_META[key].label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
