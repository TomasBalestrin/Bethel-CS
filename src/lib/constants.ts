import {
  LayoutDashboard,
  ListChecks,
  GraduationCap,
  Users,
  MessageSquareQuote,
  ClipboardCheck,
  Shield,
  UserCog,
  CalendarCheck,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Etapas Iniciais', href: '/etapas-iniciais', icon: ListChecks },
  { label: 'Etapas Mentoria', href: '/etapas-mentoria', icon: GraduationCap },
  { label: 'Mentorados', href: '/mentorados', icon: Users },
  { label: 'Depoimentos', href: '/depoimentos', icon: MessageSquareQuote },
  { label: 'Tarefas', href: '/tarefas', icon: ClipboardCheck },
  { label: 'Entregas', href: '/entregas', icon: CalendarCheck },
  { label: 'Especialistas', href: '/especialistas', icon: UserCog, adminOnly: true },
  { label: 'Admin', href: '/admin', icon: Shield, adminOnly: true },
]
