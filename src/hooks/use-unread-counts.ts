'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook that fetches unread WhatsApp message counts per mentee_id
 * and listens for real-time changes via Supabase Realtime.
 * Returns a map: { [menteeId]: unreadCount }
 */
export function useUnreadCounts() {
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({})
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const supabase = createClient()

    async function fetchUnread() {
      const { data, error } = await supabase
        .from('wpp_messages')
        .select('mentee_id')
        .eq('direction', 'incoming')
        .eq('is_read', false)

      if (error || !data) return

      const map: Record<string, number> = {}
      for (const row of data) {
        map[row.mentee_id] = (map[row.mentee_id] || 0) + 1
      }
      setUnreadMap(map)
    }

    fetchUnread()

    // Listen for new messages and read updates
    const channel = supabase
      .channel('wpp_unread_global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wpp_messages' },
        () => {
          // Re-fetch on any change
          fetchUnread()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return unreadMap
}
