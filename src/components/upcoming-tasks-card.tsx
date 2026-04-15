'use client'

import { Clock, X, Bell } from 'lucide-react'
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
 * Prominent banner for the dashboard home showing tasks due in next 60 min.
 */
export function UpcomingTasksCard() {
  const { tasks, dismiss } = useUpcomingTasks()

  if (tasks.length === 0) return null

  return (
    <section className="rounded-lg border-2 border-warning/40 bg-warning/5 shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-warning/30 bg-warning/10">
        <Bell className="h-4 w-4 text-warning animate-pulse" />
        <h2 className="text-sm font-semibold text-foreground">
          Tarefas próximas do prazo ({tasks.length})
        </h2>
      </div>
      <div className="p-3 space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 border border-border/50">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="h-4 w-4 text-warning shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-warning font-medium">{formatTimeUntil(task.due_at)}</span>
                  {task.mentees?.full_name && <> · {task.mentees.full_name}</>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Link
                href="/tarefas"
                className="text-xs text-accent hover:underline px-2"
              >
                Ver
              </Link>
              <button
                onClick={() => dismiss(task.id)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Dispensar lembrete"
                title="Dispensar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
