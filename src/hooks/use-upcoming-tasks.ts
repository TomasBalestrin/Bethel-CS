'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

export interface UpcomingTask {
  id: string
  title: string
  description: string | null
  due_at: string
  mentee_id: string | null
  mentees?: { id: string; full_name: string } | null
}

/**
 * Shows a native browser notification (uses the service worker if available).
 */
function showBrowserNotification(task: UpcomingTask) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const diffMs = new Date(task.due_at).getTime() - Date.now()
  const diffMin = Math.max(0, Math.round(diffMs / 60000))
  const body = `${task.mentees?.full_name ?? 'Tarefa'} · em ${diffMin} min`

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(task.title, {
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          tag: `task-${task.id}`,
          data: { url: '/tarefas' },
        }).catch(() => {
          // Fallback to direct Notification
          new Notification(task.title, { body, icon: '/icons/icon-192x192.png', tag: `task-${task.id}` })
        })
      })
    } else {
      new Notification(task.title, { body, icon: '/icons/icon-192x192.png', tag: `task-${task.id}` })
    }
  } catch {
    // ignore
  }
}

/**
 * Hook that polls for upcoming tasks (due in next 60 min) every 60 seconds.
 * Returns the list and helpers to dismiss/mark as reminded.
 * Fires a native browser notification for new tasks not seen before.
 */
export function useUpcomingTasks() {
  const [tasks, setTasks] = useState<UpcomingTask[]>([])
  const [loading, setLoading] = useState(true)
  const notifiedIdsRef = useRef<Set<string>>(new Set())

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/upcoming', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const incoming = (data.tasks || []) as UpcomingTask[]
        // Fire notification for tasks we haven't shown yet this session
        incoming.forEach((t) => {
          if (!notifiedIdsRef.current.has(t.id)) {
            notifiedIdsRef.current.add(t.id)
            showBrowserNotification(t)
          }
        })
        setTasks(incoming)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const dismiss = useCallback(async (taskId: string) => {
    // Optimistic: remove from list
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    try {
      await fetch('/api/tasks/mark-reminded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
    } catch {
      // ignore, will show again on next poll
    }
  }, [])

  useEffect(() => {
    // Request notification permission once (ignored if already granted/denied)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    fetchTasks()
    const interval = setInterval(fetchTasks, 60000) // poll every 60s
    return () => clearInterval(interval)
  }, [fetchTasks])

  return { tasks, loading, dismiss, refresh: fetchTasks }
}
