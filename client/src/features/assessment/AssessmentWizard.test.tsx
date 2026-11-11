import { ASSESSMENT_QUESTIONS } from '@kodav/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileStore } from '~/stores/profile';
import { renderWithProviders } from '~/test/render';
import { AssessmentWizard } from './AssessmentWizard';

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('AssessmentWizard', () => {
  beforeEach(() => useProfileStore.setState({ profile: 'pme' }));
  afterEach(() => vi.unstubAllGlobals());

  it('calcule le score, affiche les points urgents et envoie le rapport', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      json: () => Promise.resolve({ success: true, data: { received: true, score: 86 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<AssessmentWizard services={[]} />);

    fireEvent.click(screen.getByLabelText('6 à 20 postes'));
    fireEvent.click(screen.getByRole('button', { name: 'Commencer le bilan' }));
    for (const q of ASSESSMENT_QUESTIONS) {
      await screen.findByRole('heading', { name: q.label });
      const pick =
        q.key === 'backup' ? q.options.at(-1)! : q.key === 'wifi' ? q.options[1]! : q.options[0]!;
      fireEvent.click(screen.getByLabelText(pick.label));
    }

    expect(
      await screen.findByRole('img', { name: 'Score 86 sur 100, Bon niveau' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1. Sauvegardes')).toBeInTheDocument();
    expect(screen.getByText('2. Wi-Fi')).toBeInTheDocument();

    fill(/Nom et prénom/, 'Awa Koné');
    fill(/^Email/, 'awa@example.ci');
    fill(/Téléphone/, '07 07 12 34 56');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir mon rapport' }));

    expect(await screen.findByText('Rapport envoyé')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toMatchObject({ profile: 'pme', seats: '6-20', phone: '+2250707123456' });
    expect(body.answers.backup).toBe('none');
  });
});
