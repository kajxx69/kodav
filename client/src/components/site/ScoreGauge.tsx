import { animate, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

const RADIUS = 80;
const ARC = Math.PI * RADIUS;

/**
 * Jauge en demi-cercle (0 à 100). La couleur porte le niveau, mais le score et le libellé
 * sont toujours écrits à côté : l'information ne repose jamais sur la couleur seule.
 */
export function ScoreGauge({
  score,
  color,
  label,
}: {
  score: number;
  /** Variable CSS du niveau, ex. `var(--color-success)`. */
  color: string;
  label: string;
}) {
  const reduced = useReducedMotion();
  const valueRef = useRef<HTMLSpanElement>(null);
  const offset = ARC * (1 - score / 100);

  useEffect(() => {
    const el = valueRef.current;
    if (!el || reduced) return;
    const controls = animate(0, score, {
      duration: 1.1,
      ease: 'easeOut',
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [score, reduced]);

  return (
    <div
      className="relative mx-auto w-full max-w-64"
      role="img"
      aria-label={`Score ${score} sur 100, ${label}`}
    >
      <svg viewBox="0 0 200 110" className="w-full" aria-hidden>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--color-surface-sunken)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <motion.path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={ARC}
          initial={{ strokeDashoffset: reduced ? offset : ARC }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduced ? 0 : 1.1, ease: 'easeOut' }}
        />
      </svg>
      <p className="absolute inset-x-0 bottom-0 text-center" aria-hidden>
        <span ref={valueRef} className="font-display text-display text-ink tabular-nums">
          {score}
        </span>
        <span className="text-body text-ink-muted"> / 100</span>
      </p>
    </div>
  );
}
