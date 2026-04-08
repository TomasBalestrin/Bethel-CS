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
      // Fetch unread counts + last messages in parallel
      const [{ data: unreadRows }, { data: lastRows }] = await Promise.all([
        supabase
          .from('wpp_messages')
          .select('mentee_id')
          .eq('direction', 'incoming')
          .eq('is_read', false)
          .limit(2000),
        supabase
          .from('wpp_messages')
          .select('mentee_id, sent_at')
          .order('sent_at', { ascending: false })
          .limit(500),
      ])

      const unreadMap: Record<string, number> = {}
      if (unreadRows) {
        for (const row of unreadRows) {
          unreadMap[row.mentee_id] = (unreadMap[row.mentee_id] || 0) + 1
        }
      }

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

    // Debounce realtime updates to avoid excessive re-fetches
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const channel = supabase
      .channel('wpp_unread_global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wpp_messages' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(fetchData, 1000)
        }
      )
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [])

  return data
}
