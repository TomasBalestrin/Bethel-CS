'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { NAV_ITEMS } from '@/lib/constants'
import { SidebarNavItem } from '@/components/sidebar-nav-item'
import { Menu, X } from 'lucide-react'
import type { Profile } from '@/types/auth'

interface AppSidebarProps {
  profile: Profile
}

export function AppSidebar({ profile }: AppSidebarProps) {
  const [open, setOpen] = useState(false)

  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || profile.role === 'admin'
  )

  // Close on route change (clicking nav item)
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-md md:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-6 w-6 text-foreground" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-primary transition-transform duration-300 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-white/10 px-5 md:h-16">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Bethel CS"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0"
              priority
            />
            <span className="font-heading text-lg font-bold text-white">
              Bethel CS
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <div key={item.href} onClick={() => setOpen(false)}>
              <SidebarNavItem item={item} />
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
