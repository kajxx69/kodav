import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { ColumnChart } from './ColumnChart';

beforeAll(() => {
  // jsdom n'a pas ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const data = [
  { key: '2026-11-01', label: '1 nov.', values: [3, 1] },
  { key: '2026-11-02', label: '2 nov.', values: [5, 2] },
];

describe('ColumnChart', () => {
  it('décrit chaque colonne, affiche l’infobulle au focus et le tableau à la demande', () => {
    render(
      <ColumnChart
        caption="Devis reçus et acceptés"
        series={[
          { name: 'Reçus', color: 'var(--chart-1)' },
          { name: 'Acceptés', color: 'var(--chart-2)' },
        ]}
        data={data}
        format={(v) => String(v)}
      />,
    );
    expect(screen.getByRole('img', { name: 'Devis reçus et acceptés' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Légende' })).toHaveTextContent('ReçusAcceptés');
    const column = screen.getByRole('button', { name: '2 nov. : Reçus 5, Acceptés 2' });
    fireEvent.focus(column);
    expect(screen.getByRole('status')).toHaveTextContent('2 nov.Reçus5Acceptés2');
    fireEvent.click(screen.getByRole('button', { name: 'Voir les données en tableau' }));
    expect(screen.getByRole('table')).toHaveTextContent('1 nov.31');
  });

  it('signale une période sans données, sans légende pour une seule série', () => {
    render(
      <ColumnChart
        caption="Tickets"
        series={[{ name: 'Tickets', color: 'red' }]}
        data={[{ key: 'a', label: 'a', values: [0] }]}
        format={String}
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Tickets : aucune donnée sur la période' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Légende' })).not.toBeInTheDocument();
  });
});
