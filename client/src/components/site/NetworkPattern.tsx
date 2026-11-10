import { cn } from '~/lib/cn';

/** Schéma réseau abstrait (traits fins) : nœuds reliés, le nœud central rappelle le logo. */
export function NetworkPattern({ className }: { className?: string }) {
  const nodes = [
    [60, 80],
    [180, 40],
    [300, 110],
    [140, 190],
    [260, 240],
    [380, 200],
    [420, 70],
    [80, 300],
    [340, 330],
  ] as const;
  const links = [
    [0, 1],
    [1, 2],
    [0, 3],
    [3, 2],
    [2, 4],
    [4, 5],
    [2, 6],
    [5, 6],
    [3, 7],
    [4, 8],
    [7, 8],
    [3, 4],
  ] as const;
  return (
    <svg
      viewBox="0 0 460 380"
      fill="none"
      aria-hidden
      className={cn('pointer-events-none', className)}
    >
      <g stroke="currentColor" strokeWidth="1">
        {links.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
          />
        ))}
      </g>
      {nodes.map(([x, y], i) =>
        i === 2 ? (
          <g key={i}>
            <circle cx={x} cy={y} r="11" stroke="var(--gold)" strokeWidth="3" fill="var(--band)" />
            <circle cx={x} cy={y} r="4" fill="var(--on-band)" />
          </g>
        ) : (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            fill="var(--band)"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        ),
      )}
    </svg>
  );
}
