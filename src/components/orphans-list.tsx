'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Phone, MessageSquare, Trash2, UserCheck, RefreshCw, Inbox } from 'lucide-react'
import { toast } from 'sonner'
import { assignOrphanToMentee, dismissOrphan } from '@/lib/actions/wpp-orphan-actions'

interface Orphan {
  id: string
  phone: string
  sender_name: string | null
  last_content: string | null
  attempts: number
  first_seen_at: string
  last_seen_at: string
}

interface Mentee {
  id: string
  full_name: string
  phone: string
}

interface Props {
  orphans: Orphan[]
  mentees: Mentee[]
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

/** Cheap suggest: rank mentees by name similarity to the orphan sender_name.
 *  Each shared word is +1, exact match is big bonus. Returns top N. */
function suggestMentees(orphan: Orphan, mentees: Mentee[], topN = 5): Mentee[] {
  const senderNorm = normalize(orphan.sender_name || '')
  if (!senderNorm) return []
  const senderWords = senderNorm.split(/\s+/).filter((w) => w.length >= 3)
  if (senderWords.length === 0) return []

  const scored = mentees.map((m) => {
    const nameNorm = normalize(m.full_name || '')
    const nameWords = new Set(nameNorm.split(/\s+/).filter((w) => w.length >= 3))
    let score = 0
    for (const w of senderWords) {
      if (nameWords.has(w)) score += 1
    }
    if (nameNorm === senderNorm) score += 10
    return { mentee: m, score }
  })

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((x) => x.mentee)
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('pt-BR')
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${time}`
}

export function OrphansList({ orphans, mentees }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // Per-orphan local search box for manual mentee lookup
  const [searches, setSearches] = useState<Record<string, string>>({})

  async function handleAssign(orphanPhone: string, menteeId: string, menteeName: string) {
    setBusy(orphanPhone)
    const result = await assignOrphanToMentee(orphanPhone, menteeId)
    setBusy(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`Telefone atribuído a ${menteeName}`)
    router.refresh()
  }

  async function handleDismiss(orphanPhone: string) {
    if (!confirm('Descartar essa mensagem órfã? Se vier de novo, voltará pra lista.')) return
    setBusy(orphanPhone)
    const result = await dismissOrphan(orphanPhone)
    setBusy(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Descartada')
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Mensagens órfãs</h1>
          <p className="text-sm text-muted-foreground">
            {orphans.length} número{orphans.length !== 1 ? 's' : ''} tentou enviar mensagem mas não bateu com nenhum mentorado cadastrado
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {orphans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Inbox className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">Nada por aqui — todas as mensagens estão batendo com um mentorado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orphans.map((o) => {
            const suggestions = suggestMentees(o, mentees)
            const search = searches[o.id] ?? ''
            const searchLower = normalize(search)
            const searchResults = searchLower.length >= 2
              ? mentees
                  .filter((m) => normalize(m.full_name).includes(searchLower) || (m.phone || '').includes(searchLower))
                  .slice(0, 8)
              : []
            return (
              <div key={o.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Phone className="h-4 w-4 text-accent" />
                      <span className="font-medium text-sm">{o.phone}</span>
                      {o.sender_name && (
                        <Badge variant="muted" className="text-[10px]">{o.sender_name}</Badge>
                      )}
                      <Badge variant="muted" className="text-[10px]">{o.attempts}× tentativas</Badge>
                    </div>
                    {o.last_content && (
                      <div className="mt-2 flex items-start gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
                        <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{o.last_content}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Última tentativa: {formatDate(o.last_seen_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(o.phone)}
                    disabled={busy === o.phone}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Descartar
                  </Button>
                </div>

                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                      Sugeridos pelo nome
                    </p>
                    <div className="space-y-1">
                      {suggestions.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-3 py-1.5">
                          <div className="min-w-0">
                            <p className="text-sm truncate">{m.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">phone atual: {m.phone || '—'}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAssign(o.phone, m.id, m.full_name)}
                            disabled={busy === o.phone}
                            className="text-xs"
                          >
                            <UserCheck className="mr-1.5 h-3 w-3" /> Atribuir
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual search */}
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Ou buscar manualmente
                  </p>
                  <Input
                    placeholder="Digite nome ou telefone do mentorado..."
                    value={search}
                    onChange={(e) => setSearches((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    className="h-8 text-sm"
                  />
                  {searchResults.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {searchResults.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-background border border-border px-3 py-1.5">
                          <div className="min-w-0">
                            <p className="text-sm truncate">{m.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{m.phone || '—'}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAssign(o.phone, m.id, m.full_name)}
                            disabled={busy === o.phone}
                            className="text-xs"
                          >
                            <UserCheck className="mr-1.5 h-3 w-3" /> Atribuir
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
