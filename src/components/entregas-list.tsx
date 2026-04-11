'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, CalendarCheck, Users, Trash2, BookOpen, BarChart3, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatDateBR } from '@/lib/format'
import { BulkImportDialog } from '@/components/kanban/bulk-import-dialog'

const DELIVERY_TYPES = [
  { value: 'hotseat', label: 'Hotseat' },
  { value: 'comercial', label: 'Entrega de Comercial' },
  { value: 'marketing', label: 'Entrega de Marketing' },
  { value: 'gestao', label: 'Entrega de Gestão' },
  { value: 'mentoria_individual', label: 'Mentoria Individual' },
  { value: 'extras', label: 'Entrega Extra' },
]

const TYPE_COLORS: Record<string, string> = {
  hotseat: 'bg-accent/10 text-accent',
  comercial: 'bg-success/10 text-success',
  marketing: 'bg-info/10 text-info',
  gestao: 'bg-warning/10 text-warning',
  mentoria_individual: 'bg-purple-500/10 text-purple-600',
  extras: 'bg-muted text-muted-foreground',
}

interface DeliveryEvent {
  id: string
  delivery_type: string
  delivery_date: string
  description?: string | null
  notes?: string | null
  reference_month?: string | null
  created_at: string
  participation_count: number
}

interface EntregasListProps {
  events: DeliveryEvent[]
}

function getMonthLabel(month: string) {
  const [year, m] = month.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[parseInt(m) - 1]} ${year}`
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function EntregasList({ events }: EntregasListProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [monthFilter, setMonthFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  // Registration form state
  const [refMonth, setRefMonth] = useState(getCurrentMonth())
  const [newType, setNewType] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [pendingEvents, setPendingEvents] = useState<{ type: string; date: string; description: string }[]>([])
  const [saving, setSaving] = useState(false)

  // Filters
  const months = useMemo(() => {
    const set = new Set<string>()
    events.forEach((e) => { if (e.reference_month) set.add(e.reference_month) })
    return Array.from(set).sort().reverse()
  }, [events])

  const filtered = events.filter((e) => {
    if (monthFilter && e.reference_month !== monthFilter) return false
    if (typeFilter && e.delivery_type !== typeFilter) return false
    return true
  })

  // Metrics
  const metrics = useMemo(() => {
    const src = monthFilter ? filtered : events
    const total = src.length
    const totalParticipations = src.reduce((s, e) => s + e.participation_count, 0)
    const typeCounts: Record<string, number> = {}
    src.forEach((e) => { typeCounts[e.delivery_type] = (typeCounts[e.delivery_type] ?? 0) + 1 })
    const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]
    return { total, totalParticipations, topType }
  }, [events, filtered, monthFilter])

  function addPending() {
    if (!newType || !newDate) {
      toast.error('Selecione tipo e data')
      return
    }
    setPendingEvents((prev) => [...prev, { type: newType, date: newDate, description: newDesc }])
    setNewDate('')
    setNewDesc('')
  }

  function removePending(idx: number) {
    setPendingEvents((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSaveAll() {
    if (pendingEvents.length === 0) {
      toast.error('Adicione pelo menos uma entrega')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const inserts = pendingEvents.map((e) => ({
      delivery_type: e.type,
      delivery_date: e.date,
      description: e.description || null,
      reference_month: refMonth,
    }))

    const { error } = await supabase.from('delivery_events').insert(inserts)
    setSaving(false)

    if (error) {
      toast.error('Erro ao salvar entregas')
      return
    }

    toast.success(`${pendingEvents.length} entrega${pendingEvents.length > 1 ? 's' : ''} cadastrada${pendingEvents.length > 1 ? 's' : ''}`)
    setPendingEvents([])
    setNewType('')
    setNewDate('')
    setNewDesc('')
    setDialogOpen(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    await supabase.from('delivery_events').delete().eq('id', id)
    toast.success('Entrega excluída')
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Entregas</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} entrega{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar Entregas
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 mb-6">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md p-1.5 bg-accent/10"><CalendarCheck className="h-4 w-4 text-accent" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Total de entregas</p>
              <p className="font-heading text-lg font-bold">{metrics.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md p-1.5 bg-success/10"><Users className="h-4 w-4 text-success" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Total participações</p>
              <p className="font-heading text-lg font-bold">{metrics.totalParticipations}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md p-1.5 bg-info/10"><BarChart3 className="h-4 w-4 text-info" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Tipo mais frequente</p>
              <p className="font-heading text-sm font-bold">{metrics.topType ? DELIVERY_TYPES.find((t) => t.value === metrics.topType![0])?.label ?? metrics.topType[0] : '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="w-48">
          <Select value={monthFilter} onValueChange={(v) => setMonthFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Todos os meses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os meses</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os tipos</SelectItem>
              {DELIVERY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhuma entrega cadastrada</p>
            <Button size="sm" variant="ghost" className="mt-2 text-xs text-accent" onClick={() => setDialogOpen(true)}>
              Cadastrar entregas
            </Button>
          </div>
        )}
        {filtered.map((event) => (
          <div key={event.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 group hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <Badge className={`text-[10px] ${TYPE_COLORS[event.delivery_type] ?? 'bg-muted text-muted-foreground'}`}>
                {DELIVERY_TYPES.find((t) => t.value === event.delivery_type)?.label ?? event.delivery_type}
              </Badge>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {formatDateBR(event.delivery_date)}
                  {event.reference_month && <span className="text-xs text-muted-foreground ml-2">({getMonthLabel(event.reference_month)})</span>}
                </p>
                {event.description && <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{event.participation_count} participações</span>
              <button
                onClick={() => handleDelete(event.id)}
                className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Registration dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar Entregas do Mês</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Reference month */}
            <div className="space-y-1">
              <Label>Mês de referência</Label>
              <Input type="month" value={refMonth} onChange={(e) => setRefMonth(e.target.value)} />
            </div>

            {/* Add delivery form */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Nova entrega</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo *</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {DELIVERY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Data *</Label>
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Tema, observações..." rows={2} />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addPending}>
                <Plus className="mr-1 h-3 w-3" /> Adicionar à lista
              </Button>
            </div>

            {/* Pending list */}
            {pendingEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Entregas a cadastrar ({pendingEvents.length}):</p>
                {pendingEvents.map((pe, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] ${TYPE_COLORS[pe.type] ?? ''}`}>
                        {DELIVERY_TYPES.find((t) => t.value === pe.type)?.label}
                      </Badge>
                      <span>{new Date(pe.date).toLocaleDateString('pt-BR')}</span>
                      {pe.description && <span className="text-muted-foreground truncate max-w-[150px]">— {pe.description}</span>}
                    </div>
                    <button onClick={() => removePending(idx)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAll} disabled={saving || pendingEvents.length === 0}>
              {saving ? 'Salvando...' : `Salvar ${pendingEvents.length} entrega${pendingEvents.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        initialTab="delivery_participations"
        visibleTabs={['delivery_events', 'delivery_participations']}
      />
    </div>
  )
}
