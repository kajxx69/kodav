import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

const formatter = new Intl.NumberFormat('fr-FR');

/** Compteur animé au premier affichage ; valeur finale directe si les animations sont réduites. */
export function AnimatedCounter({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduced) return;
    const controls = animate(0, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => {
        el.textContent = formatter.format(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, reduced, value]);

  // Valeur réelle dans le HTML (pré-rendu, lecteurs d'écran) ; l'animation la rejoue.
  return <span ref={ref}>{formatter.format(value)}</span>;
}
