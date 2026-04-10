'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Notification {
  id: string
  mentee_id: string | null
  department: string
  description: string
  mentee_name: string
  mentee_phone: string
  is_read: boolean
  created_at: string
}

export function ForwardingBadge() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Fetch notifications on mount and poll every 30s
  useEffect(() => {
    const supabase = createClient()

    async function fetch() {
      const { data } = await supabase
        .from('forwarding_notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifications(data)
    }

    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [])

  // Update browser tab title
  useEffect(() => {
    const base = 'Bethel CS'
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) ${base}`
    } else {
      document.title = base
    }
  }, [unreadCount])

  async function markAsRead(id: string) {
    const supabase = createClient()
    await supabase.from('forwarding_notifications').update({ is_read: true }).eq('id', id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  async function markAllAsRead() {
    const supabase = createClient()
    const ids = notifications.map((n) => n.id)
    if (ids.length > 0) {
      await supabase.from('forwarding_notifications').update({ is_read: true }).in('id', ids)
    }
    setNotifications([])
    setOpen(false)
  }

  function openMentee(menteeId: string) {
    router.push(`/mentorados?open=${menteeId}`)
    setOpen(false)
  }

  const deptLabel = (d: string) => d === 'comercial' ? 'Comercial' : d === 'marketing' ? 'Marketing' : d === 'gestao' ? 'Gestão' : d === 'system' ? 'Sistema' : d

  if (unreadCount === 0) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-full p-2 hover:bg-muted transition-colors"
        title={`${unreadCount} encaminhamento${unreadCount !== 1 ? 's' : ''} pendente${unreadCount !== 1 ? 's' : ''}`}
      >
        <Bell className="h-5 w-5 text-foreground" />
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encaminhamentos</DialogTitle>
            <DialogDescription>{unreadCount} pendente{unreadCount !== 1 ? 's' : ''}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-accent">{deptLabel(n.department)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm font-medium">{n.mentee_name}</p>
                <p className="text-xs text-muted-foreground">{n.mentee_phone}</p>
                <p className="text-xs text-foreground">{n.description}</p>
                <div className="flex items-center gap-2 pt-1">
                  {n.department !== 'system' && n.mentee_id && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => openMentee(n.mentee_id!)}>
                      Abrir mentorado
                    </Button>
                  )}
                  {n.department === 'system' && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { router.push('/admin'); setOpen(false) }}>
                      Ir para Admin
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] text-muted-foreground" onClick={() => markAsRead(n.id)}>
                    Marcar como lido
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {notifications.length > 1 && (
            <div className="flex justify-end pt-2 border-t border-border">
              <Button size="sm" variant="ghost" className="text-xs" onClick={markAllAsRead}>
                Marcar todos como lidos
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
