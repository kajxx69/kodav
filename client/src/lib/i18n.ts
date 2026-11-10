import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from '~/locales/fr/common.json';

// Ressources embarquées et initialisation synchrone : le pré-rendu sort directement en français.
// Ajouter l'anglais = un dossier locales/en/ et une entrée dans `resources`.
void i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS: 'common',
  resources: { fr: { common } },
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
