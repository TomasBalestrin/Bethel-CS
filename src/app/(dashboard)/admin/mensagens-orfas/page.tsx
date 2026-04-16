import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrphansList } from '@/components/orphans-list'

export default async function MensagensOrfasPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  // Cast through unknown because the new wpp_orphan_messages table is not yet
  // in the generated Database types. The runtime query is fine.
  const orphansResult = await (supabase.from as (name: string) => ReturnType<typeof supabase.from>)('wpp_orphan_messages')
    .select('id, phone, sender_name, last_content, attempts, first_seen_at, last_seen_at')
    .order('last_seen_at', { ascending: false })
  const orphans = (orphansResult.data ?? []) as unknown as Orphan[]

  // Mentees for the suggest/search side
  const { data: mentees } = await supabase
    .from('mentees')
    .select('id, full_name, phone')
    .order('full_name')

  return (
    <OrphansList
      orphans={orphans}
      mentees={mentees ?? []}
    />
  )
}

type Orphan = {
  id: string
  phone: string
  sender_name: string | null
  last_content: string | null
  attempts: number
  first_seen_at: string
  last_seen_at: string
}
