'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/constants'

interface SidebarNavItemProps {
  item: NavItem
}

export function SidebarNavItem({ item }: SidebarNavItemProps) {
  const pathname = usePathname()
  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-accent text-white'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
      )}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  )
}
