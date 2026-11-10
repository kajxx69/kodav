import { AppWindow, CodeXml, Layers, Network, Wrench, type LucideIcon } from 'lucide-react';

// Nom d'icône stocké en base (modifiable dans l'admin) → composant lucide.
const icons: Record<string, LucideIcon> = {
  code: CodeXml,
  network: Network,
  'app-window': AppWindow,
  wrench: Wrench,
};

export function PoleIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name] ?? Layers;
  return <Icon className={className} aria-hidden />;
}
