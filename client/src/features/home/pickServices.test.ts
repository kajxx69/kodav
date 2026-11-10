import type { Service } from '@kodav/shared';
import { describe, expect, it } from 'vitest';
import { pickServices } from './FeaturedServices';

const service = (slug: string, featured: boolean, targetProfiles: Service['targetProfiles']) =>
  ({ id: slug, slug, featured, targetProfiles }) as Service;

describe('pickServices', () => {
  const services = [
    service('a', false, ['pme']),
    service('b', true, ['particulier']),
    service('c', true, ['pme', 'ecole']),
    service('d', false, ['ecole']),
  ];

  it('met en avant les services recommandés du profil, puis les autres', () => {
    expect(pickServices(services, 'pme').map((s) => s.slug)).toEqual(['c', 'a']);
  });

  it('sans profil, affiche les recommandés en premier', () => {
    expect(pickServices(services, null, 3).map((s) => s.slug)).toEqual(['b', 'c', 'a']);
  });
});
