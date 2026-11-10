import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '~/test/render';
import { useProfileStore } from '~/stores/profile';
import { ContactForm } from './ContactForm';

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('ContactForm', () => {
  beforeEach(() => useProfileStore.setState({ profile: 'ecole' }));
  afterEach(() => vi.unstubAllGlobals());

  it('affiche les erreurs de validation sans appeler l’API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ContactForm />);
    fill(/Téléphone/, '123');
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }));
    expect(await screen.findByText('Numéro ivoirien attendu : 10 chiffres')).toBeInTheDocument();
    expect(
      screen.getByText('Votre accord est nécessaire pour être recontacté'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envoie un message normalisé, pré-rempli avec le profil mémorisé', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      json: () => Promise.resolve({ success: true, data: { received: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ContactForm defaultSubject="Demande de devis" />);

    expect(screen.getByLabelText(/Vous êtes/)).toHaveValue('ecole');
    fill(/Nom et prénom/, 'Awa Koné');
    fill(/Téléphone/, '07 07 12 34 56');
    fill(/^Email/, 'awa@example.ci');
    fill(/Votre message/, 'Nous voulons équiper une salle de 20 postes.');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }));

    expect(await screen.findByText('Message bien reçu')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toMatchObject({
      phone: '+2250707123456',
      profile: 'ecole',
      subject: 'Demande de devis',
      consent: true,
    });
  });
});
