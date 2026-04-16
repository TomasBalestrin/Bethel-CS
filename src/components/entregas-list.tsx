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
import { Plus, CalendarCheck, Users, BookOpen, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDateBR } from '@/lib/format'
import { createDeliveryEvent } from '@/lib/actions/delivery-actions'
import { EntregaPanel, DELIVERY_TYPES, type EntregaEvent } from '@/components/entrega-panel'

const TYPE_COLORS: Record<string, string> = {
  hotseat: 'bg-accent/10 text-accent',
  comercial: 'bg-success/10 text-success',
  marketing: 'bg-info/10 text-info',
  gestao: 'bg-warning/10 text-warning',
  mentoria_individual: 'bg-purple-500/10 text-purple-600',
  extras: 'bg-muted text-muted-foreground',
  sos: 'bg-red-500/10 text-red-600',
  omv: 'bg-blue-500/10 text-blue-600',
}

interface DeliveryEvent extends EntregaEvent {
  created_at: string
  notes: string | null
}

interface EntregasListProps {
  events: DeliveryEvent[]
  profiles: { id: string; full_name: string }[]
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

export function EntregasList({ events, profiles }: EntregasListProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [monthFilter, setMonthFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<DeliveryEvent | null>(null)

  // Single-entrega form state
  const [form, setForm] = useState({
    delivery_type: '',
    delivery_date: '',
    title: '',
    description: '',
    reference_month: getCurrentMonth(),
    presenter_id: '',
  })
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

  async function handleCreate() {
    if (!form.delivery_type || !form.delivery_date) {
      toast.error('Tipo e data são obrigatórios')
      return
    }
    setSaving(true)
    const result = await createDeliveryEvent({
      delivery_type: form.delivery_type,
      delivery_date: form.delivery_date,
      title: form.title || null,
      description: form.description || null,
      reference_month: form.reference_month || null,
      presenter_id: form.presenter_id || null,
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Entrega cadastrada')
    setForm({
      delivery_type: '',
      delivery_date: '',
      title: '',
      description: '',
      reference_month: getCurrentMonth(),
      presenter_id: '',
    })
    setDialogOpen(false)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Entregas</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} entrega{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Cadastrar Entrega
        </Button>
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

      {/* List — each row is clickable and opens the panel */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhuma entrega cadastrada</p>
            <Button size="sm" variant="ghost" className="mt-2 text-xs text-accent" onClick={() => setDialogOpen(true)}>
              Cadastrar entrega
            </Button>
          </div>
        )}
        {filtered.map((event) => {
          const presenterName = event.presenter_id
            ? profiles.find((p) => p.id === event.presenter_id)?.full_name
            : null
          return (
            <button
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className="w-full text-left flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-muted/30 hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Badge className={`text-[10px] shrink-0 ${TYPE_COLORS[event.delivery_type] ?? 'bg-muted text-muted-foreground'}`}>
                  {DELIVERY_TYPES.find((t) => t.value === event.delivery_type)?.label ?? event.delivery_type}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatDateBR(event.delivery_date)}
                    {event.reference_month && <span className="text-xs text-muted-foreground ml-2">({getMonthLabel(event.reference_month)})</span>}
                  </p>
                  {event.title && <p className="text-xs text-foreground mt-0.5 truncate">{event.title}</p>}
                  {!event.title && event.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>}
                  {presenterName && <p className="text-[10px] text-muted-foreground mt-0.5">Por: {presenterName}</p>}
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 ml-3">{event.participation_count} participações</span>
            </button>
          )
        })}
      </div>

      {/* Single-entrega registration dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar Entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={form.delivery_type} onValueChange={(v) => setForm({ ...form, delivery_type: v })}>
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
                <Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Hotseat Abril" />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Tema, observações..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Mês de referência</Label>
                <Input type="month" value={form.reference_month} onChange={(e) => setForm({ ...form, reference_month: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Quem fez a entrega</Label>
                <Select value={form.presenter_id || '__none__'} onValueChange={(v) => setForm({ ...form, presenter_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhum —</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Panel for the selected entrega */}
      {selectedEvent && (
        <EntregaPanel
          event={selectedEvent}
          profiles={profiles}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
