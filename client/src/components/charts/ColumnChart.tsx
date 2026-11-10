import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '~/lib/cn';

export type ChartSeries = { name: string; color: string };
export type ChartPoint = { key: string; label: string; values: number[] };

type ColumnChartProps = {
  /** Titre lu par les lecteurs d'écran et repris dans le tableau. */
  caption: string;
  series: ChartSeries[];
  data: ChartPoint[];
  format: (v: number) => string;
  /** Format compact des graduations (ex. « 150 k »). */
  formatAxis?: (v: number) => string;
  /** Valeurs entières (comptages) : pas de graduation « 0,5 ». */
  integer?: boolean;
  height?: number;
};

const PAD = { top: 12, right: 8, bottom: 28, left: 52 };

/** Graduations « rondes » : 1, 2 ou 5 × 10^n. */
function niceTicks(max: number, integer: boolean, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = Math.max(max / count, integer ? 1 : 0);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1]! < max) ticks.push(ticks[ticks.length - 1]! + step);
  return ticks;
}

/** Barre au sommet arrondi (4 px), à base carrée sur l'axe. */
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Histogramme (1 ou 2 séries) : barres fines, grille discrète, infobulle au survol et au
 * clavier, légende dès deux séries, tableau des données en alternative.
 */
export function ColumnChart({
  caption,
  series,
  data,
  format,
  formatAxis = format,
  integer = false,
  height = 220,
}: ColumnChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const id = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry!.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(0, ...data.flatMap((d) => d.values));
  const ticks = niceTicks(max, integer);
  const top = ticks[ticks.length - 1]!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const band = plotW / Math.max(data.length, 1);
  const gap = 2;
  const barW = Math.max(2, Math.min(24, (band * 0.7 - gap * (series.length - 1)) / series.length));
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => PAD.top + plotH - (top ? (v / top) * plotH : 0);
  // Étiquettes de l'axe horizontal espacées pour ne jamais se chevaucher.
  const every = Math.max(1, Math.ceil(data.length / Math.floor(plotW / 56)));
  const hover = active !== null ? data[active] : null;
  const empty = max === 0;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">{caption}</figcaption>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-4 text-caption text-ink-muted" aria-label="Légende">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={empty ? `${caption} : aucune donnée sur la période` : caption}
          className="block max-w-full overflow-visible"
          onMouseLeave={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--line)"
                strokeWidth={1}
                strokeDasharray={t === 0 ? undefined : '2 4'}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-ink-muted text-[11px] tabular-nums"
              >
                {formatAxis(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = PAD.left + band * i + (band - groupW) / 2;
            return (
              <g key={d.key}>
                {active === i && (
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                    className="fill-surface-sunken"
                  />
                )}
                {d.values.map((v, s) => (
                  <path
                    key={s}
                    d={barPath(x0 + s * (barW + gap), y(v), barW, y(0) - y(v))}
                    fill={series[s]!.color}
                  />
                ))}
                {i % every === 0 && (
                  <text
                    x={PAD.left + band * i + band / 2}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-ink-muted text-[11px]"
                  >
                    {d.label}
                  </text>
                )}
                {/* Zone de survol et de focus : toute la colonne, plus large que la barre. */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.label} : ${d.values.map((v, s) => `${series[s]!.name} ${format(v)}`).join(', ')}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
        </svg>
        {hover && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border border-line bg-surface-raised px-3 py-2 text-caption shadow-md"
            style={{
              left: Math.min(Math.max(PAD.left + band * active! + band / 2 - 72, 0), width - 160),
            }}
          >
            <p className="mb-1 text-label text-ink">{hover.label}</p>
            {hover.values.map((v, s) => (
              <p key={s} className="flex items-center justify-between gap-3 text-ink">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <span
                    className="size-2 rounded-sm"
                    style={{ background: series[s]!.color }}
                    aria-hidden
                  />
                  {series[s]!.name}
                </span>
                <span className="tabular-nums">{format(v)}</span>
              </p>
            ))}
          </div>
        )}
        {empty && (
          <p className="absolute inset-x-0 top-1/3 text-center text-body-sm text-ink-muted">
            Aucune donnée sur la période
          </p>
        )}
      </div>
      <button
        type="button"
        aria-expanded={showTable}
        aria-controls={`${id}-table`}
        onClick={() => setShowTable((v) => !v)}
        className="self-start text-caption text-link underline"
      >
        {showTable ? 'Masquer le tableau' : 'Voir les données en tableau'}
      </button>
      {showTable && (
        <div id={`${id}-table`} className="max-h-64 overflow-auto rounded-md border border-line">
          <table className="w-full text-left text-body-sm">
            <caption className="sr-only">{caption}</caption>
            <thead className="bg-surface-sunken">
              <tr>
                <th scope="col" className="px-3 py-2 text-label text-ink-muted">
                  Période
                </th>
                {series.map((s) => (
                  <th
                    key={s.name}
                    scope="col"
                    className="px-3 py-2 text-right text-label text-ink-muted"
                  >
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className={cn('border-t border-line')}>
                  <th scope="row" className="px-3 py-1.5 font-normal text-ink">
                    {d.label}
                  </th>
                  {d.values.map((v, s) => (
                    <td key={s} className="px-3 py-1.5 text-right text-ink tabular-nums">
                      {format(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
