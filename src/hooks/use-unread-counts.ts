'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UnreadData {
  unreadMap: Record<string, number>
  lastMessageMap: Record<string, string> // menteeId → latest sent_at ISO
}

/**
 * Hook that fetches unread WhatsApp message counts and last message timestamps
 * per mentee_id, with Supabase Realtime updates.
 */
export function useUnreadCounts(): UnreadData {
  const [data, setData] = useState<UnreadData>({ unreadMap: {}, lastMessageMap: {} })
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const supabase = createClient()

    async function fetchData() {
      // Fetch unread counts
      const { data: unreadRows } = await supabase
        .from('wpp_messages')
        .select('mentee_id')
        .eq('direction', 'incoming')
        .eq('is_read', false)

      const unreadMap: Record<string, number> = {}
      if (unreadRows) {
        for (const row of unreadRows) {
          unreadMap[row.mentee_id] = (unreadMap[row.mentee_id] || 0) + 1
        }
      }

      // Fetch last message per mentee (most recent first, deduplicate)
      const { data: lastRows } = await supabase
        .from('wpp_messages')
        .select('mentee_id, sent_at')
        .order('sent_at', { ascending: false })
        .limit(500)

      const lastMessageMap: Record<string, string> = {}
      if (lastRows) {
        for (const row of lastRows) {
          if (!lastMessageMap[row.mentee_id]) {
            lastMessageMap[row.mentee_id] = row.sent_at
          }
        }
      }

      setData({ unreadMap, lastMessageMap })
    }

    fetchData()

    const channel = supabase
      .channel('wpp_unread_global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wpp_messages' },
        () => { fetchData() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return data
}
