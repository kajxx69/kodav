import { Mail, Search } from 'lucide-react';
import { useState } from 'react';
import { NotFoundContent } from '~/components/site/NotFoundContent';
import { ProfileSelector } from '~/components/site/ProfileSelector';
import { Section, SectionHeader } from '~/components/site/Section';
import {
  Accordion,
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Drawer,
  EmptyState,
  Modal,
  SelectField,
  Skeleton,
  StatusTimeline,
  Stepper,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
  TextField,
  toast,
} from '~/components/ui';
import type { Route } from './+types/design-system';

export function meta(_: Route.MetaArgs) {
  return [{ title: 'Design system' }, { name: 'robots', content: 'noindex' }];
}

const trackingSteps = [
  { key: 'recue', label: 'Demande reçue', date: 'lun. 9 nov., 10:12' },
  { key: 'planifiee', label: 'Planifiée', date: 'lun. 9 nov., 14:30' },
  { key: 'en_route', label: 'Technicien en route', date: 'mar. 10 nov., 8:45' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'terminee', label: 'Terminée' },
  { key: 'validee', label: 'Validée' },
];

const demoRows = [
  { ref: 'DEV-2026-0042', client: 'Exemple SARL', amount: 450000, status: 'Envoyé' },
  { ref: 'DEV-2026-0041', client: 'École exemple', amount: 1250000, status: 'Accepté' },
  { ref: 'DEV-2026-0040', client: 'Client test', amount: 35000, status: 'Brouillon' },
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-8">
      <h2 className="text-h3">{title}</h2>
      {children}
    </div>
  );
}

/** Vitrine des composants, accessible uniquement en développement. */
export default function DesignSystem() {
  const [step, setStep] = useState(2);
  if (!import.meta.env.DEV) {
    return (
      <div className="container-page grid place-items-center py-24">
        <NotFoundContent />
      </div>
    );
  }
  return (
    <Section>
      <SectionHeader
        as="h1"
        overline="Développement"
        title="Design system"
        lead="Composants de la charte, en thème clair et sombre."
      />
      <div className="flex flex-col gap-10">
        <Block title="Typographie">
          <p className="text-display">Display</p>
          <p className="text-h1">Titre h1</p>
          <p className="text-h2">Titre h2</p>
          <p className="text-h3">Titre h3</p>
          <p className="text-h4">Titre h4</p>
          <p className="text-lead text-ink-muted">
            Lead : diagnostic, devis et intervention, sans vous déplacer.
          </p>
          <p className="text-body">Body : nous intervenons sur site, à distance ou en atelier.</p>
          <p className="text-body-sm text-ink-muted">Body-sm : réponse sous 24 h ouvrées.</p>
          <p className="text-overline text-gold-ink">Overline</p>
          <p className="text-ref">DEV-2026-0042</p>
        </Block>

        <Block title="Boutons">
          <div className="flex flex-wrap gap-3">
            <Button>Principal</Button>
            <Button variant="secondary">Secondaire</Button>
            <Button variant="outline">Contour</Button>
            <Button variant="ghost">Discret</Button>
            <Button loading>Envoi</Button>
            <Button disabled>Désactivé</Button>
            <Button size="sm" variant="outline">
              <Search aria-hidden />
              Petit
            </Button>
          </div>
          <div className="on-band flex flex-wrap gap-3 rounded-lg bg-band p-6">
            <Button>Principal</Button>
            <Button variant="outline-band">Contour sur bandeau</Button>
            <Button variant="ghost-band">Discret sur bandeau</Button>
          </div>
        </Block>

        <Block title="Badges">
          <div className="flex flex-wrap gap-2">
            <Badge>Neutre</Badge>
            <Badge variant="gold">Recommandé</Badge>
            <Badge variant="success">Accepté</Badge>
            <Badge variant="warning">En attente</Badge>
            <Badge variant="danger">Critique</Badge>
            <Badge variant="info">Planifiée</Badge>
          </div>
        </Block>

        <Block title="Champs">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Nom"
              placeholder="Awa Koné"
              help="Tel qu’il apparaîtra sur le devis"
            />
            <TextField label="Numéro WhatsApp" prefix="+225" placeholder="07 07 00 00 00" />
            <TextField label="Email" error="Adresse email invalide" defaultValue="awa@" />
            <SelectField
              label="Commune"
              placeholder="Choisir…"
              options={[
                { value: 'cocody', label: 'Cocody' },
                { value: 'plateau', label: 'Plateau' },
              ]}
            />
            <TextArea label="Message" containerClassName="sm:col-span-2" />
            <Checkbox label="J’accepte d’être recontacté" />
          </div>
        </Block>

        <Block title="Sélecteur « Je suis… »">
          <ProfileSelector />
          <div className="on-band rounded-lg bg-band p-6">
            <ProfileSelector onBand />
          </div>
        </Block>

        <Block title="Cartes, onglets, accordéon">
          <div className="grid gap-6 md:grid-cols-2">
            <Card interactive>
              <h3 className="text-h4">Carte interactive</h3>
              <p className="text-body-sm text-ink-muted">Survolez-moi.</p>
            </Card>
            <Tabs defaultValue="a">
              <TabsList>
                <TabsTrigger value="a">Mensuel</TabsTrigger>
                <TabsTrigger value="b">Annuel</TabsTrigger>
              </TabsList>
              <TabsContent value="a">Contenu mensuel</TabsContent>
              <TabsContent value="b">Contenu annuel</TabsContent>
            </Tabs>
          </div>
          <Accordion
            items={[{ id: '1', title: 'Où intervenez-vous ?', content: 'À Abidjan et environs.' }]}
          />
        </Block>

        <Block title="Stepper et timeline de suivi">
          <Stepper steps={['Services', 'Options', 'Lieu', 'Coordonnées']} current={step} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Précédent
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStep((s) => Math.min(5, s + 1))}>
              Suivant
            </Button>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <StatusTimeline steps={trackingSteps} current={step} />
            <StatusTimeline steps={trackingSteps} current={step} orientation="horizontal" />
          </div>
        </Block>

        <Block title="Modale, tiroir, notifications">
          <div className="flex flex-wrap gap-3">
            <Modal
              trigger={<Button variant="outline">Ouvrir une modale</Button>}
              title="Confirmer l’annulation"
              description="Le rendez-vous du 10 novembre sera annulé."
              footer={<Button variant="secondary">Confirmer</Button>}
            />
            <Drawer trigger={<Button variant="outline">Ouvrir un tiroir</Button>} title="Filtres">
              <p className="text-body-sm">Contenu du tiroir.</p>
            </Drawer>
            <Button
              variant="outline"
              onClick={() =>
                toast('Devis envoyé', { variant: 'success', description: 'DEV-2026-0042' })
              }
            >
              Notification
            </Button>
            <Button
              variant="outline"
              onClick={() => toast('Envoi impossible', { variant: 'error' })}
            >
              Erreur
            </Button>
          </div>
        </Block>

        <Block title="Tableau, chargement, vide">
          <DataTable
            caption="Devis"
            rowKey={(r) => r.ref}
            rows={demoRows}
            columns={[
              {
                key: 'ref',
                header: 'Référence',
                cell: (r) => <span className="text-ref">{r.ref}</span>,
                sortValue: (r) => r.ref,
              },
              {
                key: 'client',
                header: 'Client',
                cell: (r) => r.client,
                sortValue: (r) => r.client,
              },
              {
                key: 'amount',
                header: 'Montant',
                cell: (r) => `${r.amount.toLocaleString('fr-FR')} FCFA`,
                sortValue: (r) => r.amount,
              },
              { key: 'status', header: 'Statut', cell: (r) => <Badge>{r.status}</Badge> },
            ]}
          />
          <DataTable
            caption="Chargement"
            rowKey={() => ''}
            rows={undefined}
            loading
            columns={[{ key: 'a', header: 'Colonne', cell: () => null }]}
          />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 flex-1" />
          </div>
          <EmptyState
            icon={Mail}
            title="Aucun message"
            description="Les messages apparaîtront ici."
          />
        </Block>
      </div>
    </Section>
  );
}
