'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/constants'

interface SidebarNavItemProps {
  item: NavItem
}

export function SidebarNavItem({ item }: SidebarNavItemProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  const Icon = item.icon

  const handlePrefetch = useCallback(() => {
    if (!isActive) router.prefetch(item.href)
  }, [isActive, item.href, router])

  return (
    <Link
      href={item.href}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
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
