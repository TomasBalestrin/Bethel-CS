'use client'

import { Bell, Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useUpcomingTasks } from '@/hooks/use-upcoming-tasks'
import Link from 'next/link'

function formatTimeUntil(dueAt: string): string {
  const diffMs = new Date(dueAt).getTime() - Date.now()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin <= 0) return 'agora'
  if (diffMin < 60) return `em ${diffMin} min`
  return `em ${Math.floor(diffMin / 60)}h ${diffMin % 60}min`
}

/**
 * Bell icon for the header with a badge counting upcoming tasks.
 * Click opens a popover with the list.
 */
export function UpcomingTasksBell() {
  const { tasks, dismiss } = useUpcomingTasks()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const count = tasks.length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors"
        aria-label="Tarefas próximas"
        title="Tarefas próximas"
      >
        <Bell className={`h-5 w-5 ${count > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-background">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card shadow-lg z-50">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-semibold text-foreground">
              {count > 0 ? `Tarefas próximas (${count})` : 'Sem tarefas próximas'}
            </p>
            <p className="text-[11px] text-muted-foreground">Nos próximos 60 minutos</p>
          </div>
          {count === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Tudo em dia por enquanto</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-border">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 hover:bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                      <p className="text-xs text-warning font-medium mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatTimeUntil(task.due_at)}
                      </p>
                      {task.mentees?.full_name && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{task.mentees.full_name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => dismiss(task.id)}
                      className="text-[10px] text-muted-foreground hover:text-foreground shrink-0"
                    >
                      Dispensar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="px-3 py-2 border-t border-border">
            <Link
              href="/tarefas"
              onClick={() => setOpen(false)}
              className="text-xs text-accent hover:underline"
            >
              Ver todas as tarefas →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
