import { CalendarCheck } from 'lucide-react';
import { SpaceHeader } from '~/components/app/AppShell';
import { EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui';
import { useAuthStore } from '~/stores/auth';

const today = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Africa/Abidjan',
});

export default function TechnicianToday() {
  const user = useAuthStore((s) => s.user);
  return (
    <>
      <SpaceHeader
        title={`Bonjour ${user?.firstName ?? ''}`}
        lead={<span className="first-letter:uppercase">{today.format(new Date())}</span>}
      />
      <Tabs defaultValue="day">
        <TabsList aria-label="Période">
          <TabsTrigger value="day">Aujourd’hui</TabsTrigger>
          <TabsTrigger value="week">Cette semaine</TabsTrigger>
        </TabsList>
        <TabsContent value="day">
          <EmptyState
            icon={CalendarCheck}
            title="Aucune intervention aujourd’hui"
            description="Les interventions qui vous sont assignées apparaîtront ici, avec l’itinéraire et le rapport à remplir."
          />
        </TabsContent>
        <TabsContent value="week">
          <EmptyState
            icon={CalendarCheck}
            title="Aucune intervention cette semaine"
            description="Votre planning de la semaine s’affichera ici."
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
