import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '~/test/render';
import { useProfileStore } from '~/stores/profile';
import { ProfileSelector } from './ProfileSelector';

describe('ProfileSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    useProfileStore.setState({ profile: null });
  });

  it('sélectionne un profil et le mémorise', () => {
    renderWithProviders(<ProfileSelector />);
    const pme = screen.getByRole('radio', { name: /PME/ });
    fireEvent.click(pme);
    expect(pme).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('kodav:profile')).toBe('pme');
  });

  it('se navigue aux flèches du clavier', () => {
    useProfileStore.setState({ profile: 'particulier' });
    renderWithProviders(<ProfileSelector />);
    fireEvent.keyDown(screen.getByRole('radio', { name: /Particulier/ }), { key: 'ArrowRight' });
    expect(useProfileStore.getState().profile).toBe('pme');
    expect(screen.getByRole('radio', { name: /PME/ })).toHaveFocus();
  });

  it('relit le profil mémorisé et ignore une valeur inconnue', () => {
    localStorage.setItem('kodav:profile', 'ecole');
    useProfileStore.getState().hydrate();
    expect(useProfileStore.getState().profile).toBe('ecole');

    useProfileStore.setState({ profile: null });
    localStorage.setItem('kodav:profile', 'pirate');
    useProfileStore.getState().hydrate();
    expect(useProfileStore.getState().profile).toBeNull();
  });
});
