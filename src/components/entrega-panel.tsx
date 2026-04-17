'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Pencil, Trash2, Upload, Save, UserPlus, Ban, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatDateBR } from '@/lib/format'
import {
  updateDeliveryEvent,
  deleteDeliveryEvent,
  addParticipantToEvent,
  removeParticipantFromEvent,
  importParticipantsForEvent,
  toggleDeliveryCancelled,
} from '@/lib/actions/delivery-actions'

export const DELIVERY_TYPES = [
  { value: 'hotseat', label: 'Hotseat' },
  { value: 'comercial', label: 'Entrega de Comercial' },
  { value: 'marketing', label: 'Entrega de Marketing' },
  { value: 'gestao', label: 'Entrega de Gestão' },
  { value: 'mentoria_individual', label: 'Mentoria Individual' },
  { value: 'extras', label: 'Entrega Extra' },
  { value: 'sos', label: 'SOS' },
  { value: 'omv', label: 'OMV' },
]

export interface EntregaEvent {
  id: string
  delivery_type: string
  delivery_date: string
  title: string | null
  description: string | null
  reference_month: string | null
  presenter_name: string | null
  cancelled_at: string | null
  participation_count: number
}

interface Participant {
  id: string // participation id
  mentee_id: string
  full_name: string
  phone: string
}

interface EntregaPanelProps {
  event: EntregaEvent
  onClose: () => void
}

export function EntregaPanel({ event, onClose }: EntregaPanelProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    delivery_type: event.delivery_type,
    delivery_date: event.delivery_date,
    title: event.title ?? '',
    description: event.description ?? '',
    reference_month: event.reference_month ?? '',
    presenter_name: event.presenter_name ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [togglingCancel, setTogglingCancel] = useState(false)
  const isCancelled = !!event.cancelled_at

  // Participants
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loadingParts, setLoadingParts] = useState(true)

  // Manual add
  const [addSearch, setAddSearch] = useState('')
  const [allMentees, setAllMentees] = useState<{ id: string; full_name: string; phone: string }[]>([])

  // Import
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data } = await supabase
        .from('delivery_participations')
        .select('id, mentee_id, mentees!inner(full_name, phone)')
        .eq('delivery_event_id', event.id)
      const rows = (data ?? []) as unknown as Array<{
        id: string
        mentee_id: string
        mentees: { full_name: string; phone: string }
      }>
      setParticipants(rows.map((r) => ({
        id: r.id,
        mentee_id: r.mentee_id,
        full_name: r.mentees.full_name,
        phone: r.mentees.phone,
      })).sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setLoadingParts(false)
    })()
    ;(async () => {
      const { data } = await supabase.from('mentees').select('id, full_name, phone').order('full_name')
      if (data) setAllMentees(data)
    })()
  }, [event.id])

  async function handleSave() {
    setSaving(true)
    const result = await updateDeliveryEvent(event.id, {
      delivery_type: form.delivery_type,
      delivery_date: form.delivery_date,
      title: form.title || null,
      description: form.description || null,
      reference_month: form.reference_month || null,
      presenter_name: form.presenter_name || null,
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Entrega atualizada')
    setEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteDeliveryEvent(event.id)
    setDeleting(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Entrega excluída')
    router.refresh()
    onClose()
  }

  async function handleToggleCancelled() {
    setTogglingCancel(true)
    const result = await toggleDeliveryCancelled(event.id, !isCancelled)
    setTogglingCancel(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(isCancelled ? 'Cancelamento revertido' : 'Entrega cancelada')
    router.refresh()
  }

  async function handleAddMentee(menteeId: string) {
    const mentee = allMentees.find((m) => m.id === menteeId)
    if (!mentee) return
    const result = await addParticipantToEvent(event.id, menteeId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    // Optimistic: append + sort
    if (!participants.some((p) => p.mentee_id === menteeId)) {
      setParticipants((prev) =>
        [...prev, { id: crypto.randomUUID(), mentee_id: menteeId, full_name: mentee.full_name, phone: mentee.phone }]
          .sort((a, b) => a.full_name.localeCompare(b.full_name))
      )
      toast.success(`${mentee.full_name} adicionado(a)`)
    }
    setAddSearch('')
  }

  async function handleRemoveMentee(menteeId: string) {
    const previous = participants
    setParticipants((prev) => prev.filter((p) => p.mentee_id !== menteeId))
    const result = await removeParticipantFromEvent(event.id, menteeId)
    if (result.error) {
      setParticipants(previous)
      toast.error(result.error)
      return
    }
    toast.success('Removido')
  }

  async function handleImportFile(file: File) {
    setImporting(true)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      // Flexible header mapping — accept any of name / phone / email
      const rowsNormalized = rows.map((r) => {
        const entries = Object.entries(r).map(([k, v]) => [k.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), String(v ?? '').trim()] as const)
        const pick = (...keys: string[]) => {
          for (const key of keys) {
            const hit = entries.find(([k]) => k === key || k.includes(key))
            if (hit && hit[1]) return hit[1]
          }
          return ''
        }
        return {
          name: pick('nome', 'name', 'mentorado', 'full name'),
          phone: pick('telefone', 'phone', 'whatsapp', 'celular', 'cel', 'tel', 'fone'),
          email: pick('email', 'e-mail', 'mail'),
        }
      })

      const result = await importParticipantsForEvent({ eventId: event.id, rows: rowsNormalized })

      if (result.added > 0) {
        // Refresh participant list
        const supabase = createClient()
        const { data } = await supabase
          .from('delivery_participations')
          .select('id, mentee_id, mentees!inner(full_name, phone)')
          .eq('delivery_event_id', event.id)
        const refreshed = (data ?? []) as unknown as Array<{
          id: string
          mentee_id: string
          mentees: { full_name: string; phone: string }
        }>
        setParticipants(refreshed.map((r) => ({
          id: r.id,
          mentee_id: r.mentee_id,
          full_name: r.mentees.full_name,
          phone: r.mentees.phone,
        })).sort((a, b) => a.full_name.localeCompare(b.full_name)))
      }

      const errorSuffix = result.errors.length > 0 ? `, ${result.errors.length} não encontrado(s)` : ''
      toast.success(`${result.added} adicionado(s), ${result.already} já eram participantes${errorSuffix}`)
      if (result.errors.length > 0) {
        console.warn('[EntregaPanel] Import errors:', result.errors)
      }
      router.refresh()
    } catch (err) {
      toast.error('Erro ao processar arquivo: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  const searchLower = addSearch.toLowerCase().trim()
  const participantIds = new Set(participants.map((p) => p.mentee_id))
  const searchResults = searchLower
    ? allMentees
        .filter((m) => !participantIds.has(m.id) && (
          m.full_name.toLowerCase().includes(searchLower) ||
          (m.phone || '').includes(searchLower)
        ))
        .slice(0, 10)
    : []

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-xl bg-background border-l border-border overflow-y-auto shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background">
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Entrega</p>
              <h2 className={`font-heading text-lg font-bold ${isCancelled ? 'line-through text-destructive' : ''}`}>
                {event.title || DELIVERY_TYPES.find((t) => t.value === event.delivery_type)?.label || event.delivery_type}
              </h2>
            </div>
            {isCancelled && (
              <span className="inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                Cancelada
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-5">
          {/* Cancelled banner */}
          {isCancelled && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span className="font-semibold">Entrega cancelada</span>
              {event.cancelled_at && <span className="ml-1 opacity-80">em {formatDateBR(event.cancelled_at)}</span>}
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {!editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm({
                  delivery_type: event.delivery_type,
                  delivery_date: event.delivery_date,
                  title: event.title ?? '',
                  description: event.description ?? '',
                  reference_month: event.reference_month ?? '',
                  presenter_name: event.presenter_name ?? '',
                }) }}>
                  Cancelar
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleCancelled}
              disabled={togglingCancel}
              className={isCancelled ? '' : 'text-destructive hover:bg-destructive/10 border-destructive/40'}
            >
              {isCancelled ? (
                <><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {togglingCancel ? 'Revertendo...' : 'Reverter cancelamento'}</>
              ) : (
                <><Ban className="mr-1.5 h-3.5 w-3.5" /> {togglingCancel ? 'Cancelando...' : 'Cancelar'}</>
              )}
            </Button>
          </div>

          {/* Fields */}
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            {editing ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={form.delivery_type} onValueChange={(v) => setForm({ ...form, delivery_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DELIVERY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Hotseat Abril" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Tema, observações, resultados..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Mês de referência</Label>
                    <Input type="month" value={form.reference_month} onChange={(e) => setForm({ ...form, reference_month: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Quem fez a entrega</Label>
                    <Input
                      value={form.presenter_name}
                      onChange={(e) => setForm({ ...form, presenter_name: e.target.value })}
                      placeholder="Nome de quem entregou"
                    />
                  </div>
                </div>
              </>
            ) : (
              <dl className="space-y-2 text-sm">
                <Row label="Tipo" value={DELIVERY_TYPES.find((t) => t.value === event.delivery_type)?.label ?? event.delivery_type} />
                <Row label="Data" value={formatDateBR(event.delivery_date)} />
                {event.title && <Row label="Título" value={event.title} />}
                {event.description && <Row label="Descrição" value={event.description} multiline />}
                {event.reference_month && <Row label="Mês de referência" value={event.reference_month} />}
                <Row label="Quem fez a entrega" value={event.presenter_name || '—'} />
              </dl>
            )}
          </div>

          {/* Participants */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Participantes</h3>
                <p className="text-xs text-muted-foreground">{participants.length} mentorado(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => importInputRef.current?.click()} disabled={importing}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> {importing ? 'Importando...' : 'Importar'}
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleImportFile(f)
                  }}
                />
              </div>
            </div>

            {/* Manual add */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Buscar mentorado para adicionar..."
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                />
              </div>
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 z-10 mt-1 rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleAddMentee(m.id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
                    >
                      <span className="truncate">{m.full_name}</span>
                      <UserPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Participant list */}
            {loadingParts ? (
              <p className="text-xs text-muted-foreground text-center py-3">Carregando...</p>
            ) : participants.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhum participante registrado</p>
            ) : (
              <ul className="space-y-1 max-h-80 overflow-y-auto">
                {participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-sm">
                    <span className="truncate">{p.full_name}</span>
                    <button
                      onClick={() => handleRemoveMentee(p.mentee_id)}
                      className="opacity-60 hover:opacity-100 hover:text-destructive transition-colors"
                      title="Remover participante"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Delete confirm */}
        {confirmDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setConfirmDelete(false)}>
            <div className="bg-background rounded-lg p-5 max-w-sm mx-4 border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-base mb-1">Excluir esta entrega?</h3>
              <p className="text-sm text-muted-foreground mb-4">Todas as participações serão removidas. Esta ação não pode ser desfeita.</p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-xs text-muted-foreground uppercase tracking-wide pt-0.5">{label}</dt>
      <dd className={`text-sm text-foreground ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</dd>
    </div>
  )
}
