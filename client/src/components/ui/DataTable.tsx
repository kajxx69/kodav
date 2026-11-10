import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '~/lib/cn';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Valeur de tri ; colonne non triable si absente. */
  sortValue?: (row: T) => string | number;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  caption: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  caption,
  emptyTitle = 'Aucun résultat',
  emptyDescription,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = useMemo(() => {
    const getValue = sort && columns.find((c) => c.key === sort.key)?.sortValue;
    if (!rows || !sort || !getValue) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      return (
        (typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'fr')) * factor
      );
    });
  }, [rows, columns, sort]);

  if (!loading && rows?.length === 0) {
    return <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />;
  }

  const toggle = (key: string) =>
    setSort((s) =>
      s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised">
      <table className="w-full min-w-[36rem] border-collapse text-left text-body-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-sunken">
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key;
              const SortIcon = !active ? ArrowUpDown : sort?.dir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  className={cn('px-4 py-3 text-label text-ink-muted', col.className)}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(col.key)}
                      className="inline-flex items-center gap-1 rounded-sm hover:text-ink"
                    >
                      {col.header}
                      <SortIcon className="size-3.5" aria-hidden />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="border-t border-line">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            : sorted?.map((row) => (
                <tr key={rowKey(row)} className="border-t border-line hover:bg-surface-sunken/50">
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3 text-ink', col.className)}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
