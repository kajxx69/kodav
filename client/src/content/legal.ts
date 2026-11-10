/**
 * Gabarits des pages légales. Les passages entre crochets sont à compléter,
 * et l'ensemble doit être relu par un juriste avant la mise en ligne.
 * {legalName}, {email}, {phone} et {address} sont remplacés par les paramètres de l'admin.
 */
export const legalPages = {
  '/mentions-legales': {
    title: 'Mentions légales',
    description: 'Mentions légales du site : éditeur, hébergement, propriété intellectuelle.',
    body: `## Éditeur du site
{legalName}
Forme juridique : [à compléter]
Siège social : {address}
RCCM : [à compléter]
Numéro de compte contribuable : [à compléter]
Email : {email}
Téléphone : {phone}
Directeur de la publication : [à compléter]

## Hébergement
Site : [nom et adresse de l'hébergeur du site]
API et base de données : [nom et adresse des hébergeurs]

## Propriété intellectuelle
L'ensemble des contenus de ce site (textes, logos, illustrations) est la propriété de {legalName}, sauf mention contraire. Toute reproduction sans autorisation écrite est interdite.

Les noms de logiciels et d'éditeurs cités appartiennent à leurs propriétaires respectifs et sont mentionnés à titre informatif.

## Responsabilité
Les tarifs affichés sur ce site sont indicatifs. Seul le devis signé engage les parties.`,
  },
  '/confidentialite': {
    title: 'Politique de confidentialité',
    description: 'Comment nous collectons, utilisons et protégeons vos données personnelles.',
    body: `## Responsable du traitement
{legalName}, {address}. Contact : {email}.

## Cadre légal
Les traitements de données à caractère personnel réalisés sur ce site respectent la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel. [Préciser les formalités accomplies auprès de l'ARTCI.]

## Données collectées
- Formulaires de contact, de devis et de diagnostic : nom, téléphone, email, entreprise, commune et contenu de votre demande.
- Espace client : informations de compte, demandes, rendez-vous, tickets et inventaire du parc informatique que vous renseignez.
- Données techniques : journaux de sécurité du serveur (adresse IP, date), conservés [durée à préciser].

## Finalités
Répondre à vos demandes, établir des devis et factures, organiser les interventions, assurer le support et la sécurité du service. Vos données ne sont jamais vendues.

## Durées de conservation
- Prospects sans suite : [durée à préciser, par exemple 3 ans après le dernier contact].
- Clients : pendant la relation contractuelle, puis selon les obligations comptables et légales.

## Cookies
Ce site n'utilise que des cookies nécessaires à son fonctionnement (session de connexion). Les préférences d'affichage (thème, profil) sont conservées dans votre navigateur uniquement.

## Vos droits
Vous disposez d'un droit d'accès, de rectification, d'opposition et de suppression de vos données. Écrivez-nous à {email}. Vous pouvez également saisir l'ARTCI.`,
  },
  '/cgv': {
    title: 'Conditions générales de vente',
    description: 'Conditions générales de vente des prestations informatiques.',
    body: `## Objet
Les présentes conditions régissent les prestations proposées par {legalName} : développement, réseaux et systèmes, installation de logiciels, maintenance et support.

## Devis
Toute prestation fait l'objet d'un devis. L'estimation affichée en ligne est indicative. Le devis est valable [30] jours à compter de son émission ; il devient ferme après acceptation écrite ou en ligne.

## Exécution
Les délais indiqués sont estimatifs. Le client s'engage à donner accès aux locaux, équipements et informations nécessaires.

## Prix et paiement
Les prix sont exprimés en francs CFA. Modalités de paiement : espèces, virement ou Mobile Money, selon les conditions du devis. [Préciser acompte, échéances et pénalités de retard.]

## Licences
{legalName} installe exclusivement des logiciels sous licence authentique, acquise par le client ou fournie sur devis.

## Responsabilité et données
Le client reste responsable de la sauvegarde de ses données avant toute intervention, sauf contrat de sauvegarde en cours. [À compléter.]

## Contrats de maintenance
Durée, renouvellement, délais d'intervention et conditions de résiliation figurent dans chaque contrat. [À compléter.]

## Litiges
Droit applicable : droit ivoirien. [Préciser la juridiction compétente.]`,
  },
} as const;

export type LegalPath = keyof typeof legalPages;
