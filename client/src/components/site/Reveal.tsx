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
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
