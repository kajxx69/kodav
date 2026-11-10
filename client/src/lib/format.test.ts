import { describe, expect, it } from 'vitest';
import { durationLabel, priceLabel, telLink, whatsappLink } from './format';

describe('priceLabel', () => {
  it('affiche un forfait, un prix unitaire ou « sur devis »', () => {
    expect(priceLabel({ pricingMode: 'forfait', priceMin: 250000 })).toBe(
      'À partir de 250 000 FCFA',
    );
    expect(priceLabel({ pricingMode: 'par_unite', priceMin: 15000, unitLabel: 'heure' })).toBe(
      'À partir de 15 000 FCFA / heure',
    );
    expect(priceLabel({ pricingMode: 'sur_devis' })).toBe('Sur devis');
  });
});

describe('durationLabel', () => {
  it('accorde l’unité', () => {
    expect(durationLabel({ min: 1, max: 3, unit: 'semaine' })).toBe('1 à 3 semaines');
    expect(durationLabel({ min: 1, max: 1, unit: 'jour' })).toBe('1 jour');
  });
});

describe('liens de contact', () => {
  it('ne produit aucun lien tant que le numéro est un modèle', () => {
    expect(whatsappLink('+225XXXXXXXXXX', 'Bonjour')).toBeNull();
    expect(telLink('+225XXXXXXXXXX')).toBeNull();
  });
  it('pré-remplit le message WhatsApp', () => {
    expect(whatsappLink('+2250707123456', 'Bonjour KODAV')).toBe(
      'https://wa.me/2250707123456?text=Bonjour%20KODAV',
    );
    expect(telLink('+2250707123456')).toBe('tel:+2250707123456');
  });
});
