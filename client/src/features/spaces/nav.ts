import {
  Building2,
  CalendarClock,
  CalendarDays,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Monitor,
  Newspaper,
  Package,
  ReceiptText,
  Settings,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';
import type { SpaceNavItem } from '~/components/app/AppShell';

export const clientNav: SpaceNavItem[] = [
  { to: '/espace-client', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/espace-client/devis', label: 'Mes devis', icon: FileText },
  { to: '/espace-client/rendez-vous', label: 'Mes rendez-vous', icon: CalendarClock },
  { to: '/espace-client/tickets', label: 'Support', icon: LifeBuoy },
  { to: '/espace-client/parc', label: 'Mon parc informatique', icon: Monitor },
  { to: '/espace-client/documents', label: 'Mes documents', icon: FolderOpen },
  { to: '/espace-client/profil', label: 'Profil et organisation', icon: UserRound },
];

export const technicianNav: SpaceNavItem[] = [
  { to: '/technicien', label: 'Interventions', icon: Wrench, end: true },
  { to: '/technicien/tickets', label: 'Tickets', icon: LifeBuoy },
  { to: '/technicien/profil', label: 'Profil', icon: UserRound },
];

export const adminNav: SpaceNavItem[] = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/admin/devis', label: 'Devis', icon: FileText },
  { to: '/admin/factures', label: 'Factures', icon: ReceiptText },
  { to: '/admin/planning', label: 'Planning', icon: CalendarDays },
  { to: '/admin/tickets', label: 'Tickets', icon: LifeBuoy },
  { to: '/admin/clients', label: 'Clients', icon: Building2 },
  { to: '/admin/prospects', label: 'Prospects', icon: Inbox },
  { to: '/admin/catalogue', label: 'Catalogue', icon: Package },
  { to: '/admin/contenu', label: 'Contenu', icon: Newspaper },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
  { to: '/admin/parametres', label: 'Paramètres', icon: Settings },
];
