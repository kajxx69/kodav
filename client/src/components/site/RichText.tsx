import { Fragment } from 'react';
import { cn } from '~/lib/cn';

/**
 * Rendu sûr d'un texte long saisi dans l'admin : paragraphes, listes à puces (« - »)
 * et intertitres (« ## »). Aucun HTML n'est interprété.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className={cn('prose-kodav', className)}>
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter(Boolean);
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        if (block.startsWith('## ')) return <h2 key={i}>{block.slice(3)}</h2>;
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {l}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
