import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusTimeline } from './StatusTimeline';

const steps = [
  { key: 'a', label: 'Demande reçue' },
  { key: 'b', label: 'Planifiée' },
  { key: 'c', label: 'En cours' },
];

describe('StatusTimeline', () => {
  it('signale l’étape en cours et l’état de chaque étape', () => {
    render(<StatusTimeline steps={steps} current={1} />);
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).toHaveTextContent('Demande reçue : terminée');
    expect(items[2]).toHaveTextContent('En cours : à venir');
  });
});
