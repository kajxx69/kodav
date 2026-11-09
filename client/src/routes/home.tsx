import logo from '~/brand/logos/kodav-logo-horizontal.svg';
import { HealthStatus } from '~/components/HealthStatus';

export function meta() {
  return [
    { title: 'KODAV' },
    { name: 'description', content: "L'informatique qui fait avancer votre activité." },
  ];
}

// Page provisoire de la phase 0 : remplacée par l'accueil adaptatif en phase 1.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4">
      <img src={logo} alt="KODAV Technologies" width={240} height={64} />
      <h1 className="font-display text-3xl font-bold">Plateforme en construction</h1>
      <HealthStatus />
    </main>
  );
}
