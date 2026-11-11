import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Apparition au défilement. Les mouvements sont désactivés par MotionConfig
 * quand l'utilisateur a demandé moins d'animations ; sans JavaScript, le contenu
 * reste visible grâce à la règle <noscript> de la racine.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** `li` dans une liste : l'élément animé est lui-même l'élément de liste. */
  as?: 'div' | 'li';
}) {
  const Component = as === 'li' ? motion.li : motion.div;
  return (
    <Component
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Component>
  );
}
