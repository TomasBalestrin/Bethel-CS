'use client'

import { NAV_ITEMS } from '@/lib/constants'
import { SidebarNavItem } from '@/components/sidebar-nav-item'
import type { Profile } from '@/types/auth'

interface AppSidebarProps {
  profile: Profile
}

export function AppSidebar({ profile }: AppSidebarProps) {
  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || profile.role === 'admin'
  )

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col bg-primary">
      <div className="flex h-14 items-center border-b border-white/10 px-5">
        <span className="font-heading text-lg font-bold text-white">
          Bethel CS
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => (
          <SidebarNavItem key={item.href} item={item} />
        ))}
      </nav>
    </aside>
  )
}
