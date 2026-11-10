import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ReactRouter from 'react-router';
import { renderWithProviders } from '~/test/render';
import { useAuthStore } from '~/stores/auth';
import { useProfileStore } from '~/stores/profile';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useNavigate: () => navigate,
}));

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  navigate.mockReset();
  useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
  useProfileStore.setState({ profile: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('LoginForm', () => {
  it('affiche l’erreur de l’API puis ouvre l’espace du rôle', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        status: 401,
        json: () =>
          Promise.resolve({
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect' },
          }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { accessToken: 'jeton', user: { role: 'admin', firstName: 'Admin' } },
          }),
      });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<LoginForm />);

    fill(/^Email/, 'admin@kodav.ci');
    fill(/^Mot de passe/, 'mauvais');
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByText('Email ou mot de passe incorrect')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin', { replace: true }));
    expect(useAuthStore.getState().accessToken).toBe('jeton');
  });
});

describe('RegisterForm', () => {
  it('demande le nom de la structure pour une PME, pas pour un particulier', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useProfileStore.setState({ profile: 'pme' });
    renderWithProviders(<RegisterForm />);

    expect(screen.getByLabelText(/Vous êtes/)).toHaveValue('pme');
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(await screen.findByText('Indiquez le nom de votre structure')).toBeInTheDocument();
    expect(screen.getByText('Au moins 10 caractères')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Vous êtes/), { target: { value: 'particulier' } });
    await waitFor(() =>
      expect(screen.queryByLabelText(/Nom de l’entreprise/)).not.toBeInTheDocument(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reporte sur le champ une adresse déjà utilisée', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 409,
        json: () =>
          Promise.resolve({
            success: false,
            error: {
              code: 'CONFLICT',
              message: 'Un compte existe déjà avec cette adresse email',
              details: [
                { path: 'email', message: 'Un compte existe déjà avec cette adresse email' },
              ],
            },
          }),
      }),
    );
    renderWithProviders(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/Vous êtes/), { target: { value: 'particulier' } });
    fill(/^Prénom/, 'Awa');
    fill(/^Nom/, 'Koné');
    fill(/^Email/, 'awa@example.ci');
    fill(/Téléphone/, '0707123456');
    fill(/^Mot de passe/, 'motdepasse2026');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    const message = await screen.findByText('Un compte existe déjà avec cette adresse email');
    expect(message).toHaveAttribute('id', expect.stringMatching(/-error$/));
    expect(navigate).not.toHaveBeenCalled();
  });
});
