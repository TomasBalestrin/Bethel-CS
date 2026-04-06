'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
// Sheet no longer used — panel is fullscreen overlay
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Link2,
  Plus,
  AtSign,
  Pencil,
  Trash2,
  FileDown,
  Headphones,
  Users,
  DollarSign,
  ChevronRight,
  ArrowRight,
  MessageSquare,
  Copy,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Shield,
  Clock,
  Star,
  TrendingUp,
  Target,
  Briefcase,
  Mic,
  Loader2,
} from 'lucide-react'
import { formatDateBR } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  addIndication,
  updateIndication,
  deleteIndication,
  addIntensivoRecord,
  updateIntensivoRecord,
  deleteIntensivoRecord,
  addRevenueRecord,
  updateRevenueRecord,
  deleteRevenueRecord,
  addTestimonial,
  updateTestimonial,
  deleteTestimonial,
  generateActionPlanLink,
  toggleClienteFit,
  updateMentee,
  deleteMentee,
  addIndividualSession,
  addExtraDelivery,
  addPresentialEvent,
  updatePresentialEvent,
} from '@/lib/actions/panel-actions'
import dynamic from 'next/dynamic'
import { ErrorBoundary } from '@/components/error-boundary'
import type { MenteeRow, MenteeWithStats } from '@/types/kanban'

const TabChat = dynamic(
  () => import('./tab-chat').then((mod) => ({ default: mod.TabChat })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> }
)
import type { Database, TestimonialCategory, RevenueType } from '@/types/database'

type Indication = Database['public']['Tables']['indications']['Row']
type IntensivoRecord = Database['public']['Tables']['intensivo_records']['Row']
type RevenueRecord = Database['public']['Tables']['revenue_records']['Row']
type Testimonial = Database['public']['Tables']['testimonials']['Row']
type ActionPlan = Database['public']['Tables']['action_plans']['Row']
type Product = Database['public']['Tables']['products']['Row']
type EngagementRecord = Database['public']['Tables']['engagement_records']['Row']

// Currency mask helpers
function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseCurrencyInput(raw: string): number {
  // Keep only digits
  const digits = raw.replace(/\D/g, '')
  return parseInt(digits || '0', 10)
}

function centsToDecimal(cents: number): number {
  return cents / 100
}

interface MenteePanelProps {
  mentee: MenteeWithStats | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onMenteeDeleted?: (menteeId: string) => void
  onMenteeUpdated?: (mentee: MenteeWithStats) => void
  onTransitionToMentorship?: (mentee: MenteeWithStats) => void
}

export function MenteePanel({ mentee: menteeProp, open, onOpenChange, onMenteeDeleted, onMenteeUpdated, onTransitionToMentorship }: MenteePanelProps) {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fullData, setFullData] = useState<MenteeRow | null>(null)

  // Merge summary props with full data (fetched on open)
  const mentee = menteeProp ? { ...menteeProp, ...fullData } as MenteeWithStats : null

  useEffect(() => {
    async function fetchRoleAndFullData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setUserRole(profile?.role ?? null)

      // Fetch full mentee data (all 53 fields) for the detail panel
      if (menteeProp) {
        const { data: full } = await supabase
          .from('mentees')
          .select('*')
          .eq('id', menteeProp.id)
          .single()
        if (full) setFullData(full)
      }
    }
    if (open) {
      setFullData(null)
      fetchRoleAndFullData()
    }
  }, [open, menteeProp?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset edit state when panel closes
  useEffect(() => {
    if (!open) setEditing(false)
  }, [open])

  // Guard close when editing
  function handleClose() {
    if (editing) {
      if (window.confirm('Você tem alterações não salvas. Deseja sair?')) {
        setEditing(false)
        onOpenChange(false)
      }
    } else {
      onOpenChange(false)
    }
  }

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !deleteOpen) handleClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, deleteOpen, editing]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!mentee) return
    setDeleting(true)
    const result = await deleteMentee(mentee.id)
    setDeleting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Mentorado excluído')
      setDeleteOpen(false)
      onOpenChange(false)
      onMenteeDeleted?.(mentee.id)
    }
  }

  if (!mentee) return null

  const isAdmin = userRole === 'admin'
  const priorityLabel = `P${mentee.priority_level}`
  const isLoading = !fullData

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 min-h-[44px]"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="font-heading font-semibold text-lg sm:text-xl leading-tight truncate">
              {mentee.full_name}
            </h1>
            <Badge
              variant={
                ({ 1: 'muted', 2: 'warning', 3: 'info', 4: 'success', 5: 'accent' } as const)[
                  mentee.priority_level
                ] ?? 'muted'
              }
            >
              {priorityLabel}
            </Badge>
          </div>
          <span className="text-sm text-muted-foreground hidden md:inline">{mentee.product_name}</span>
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground ml-2">
            <span className="inline-flex items-center gap-1">
              <Headphones size={12} />
              {mentee.attendance_count} atend.
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={12} />
              {mentee.indication_count} indic.
            </span>
            <span className="inline-flex items-center gap-1">
              <DollarSign size={12} />
              R$ {(mentee.revenue_total / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing((e) => !e)}
              className="text-xs h-8 px-2.5"
            >
              <Pencil className="h-3 w-3 mr-1" />
              {editing ? 'Cancelar' : 'Editar'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="text-xs h-8 px-2.5 text-destructive border-destructive/30 hover:bg-destructive/5"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Excluir</span>
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="flex gap-2">
              {[1,2,3,4,5,6,7].map((i) => <div key={i} className="h-8 w-20 rounded bg-muted" />)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="space-y-3">
                <div className="h-40 rounded-lg bg-muted" />
                <div className="h-28 rounded-lg bg-muted" />
              </div>
              <div className="space-y-3">
                <div className="h-24 rounded-lg bg-muted" />
                <div className="h-20 rounded-lg bg-muted" />
                <div className="h-20 rounded-lg bg-muted" />
              </div>
            </div>
          </div>
        ) : (
        <PanelTabs
          mentee={mentee}
          editing={editing}
          setEditing={setEditing}
          onMenteeUpdated={onMenteeUpdated}
          isAdmin={isAdmin}
          onTransitionToMentorship={onTransitionToMentorship}
        />
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir mentorado</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir {mentee.full_name}?
                Esta ação não pode ser desfeita e removerá todos os dados associados.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting ? 'Excluindo...' : 'Sim, excluir'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  )
}

// ─── Scrollable Tabs ───
function PanelTabs({ mentee, editing, setEditing, onMenteeUpdated, isAdmin, onTransitionToMentorship }: {
  mentee: MenteeWithStats
  editing: boolean
  setEditing: (v: boolean) => void
  onMenteeUpdated?: (mentee: MenteeWithStats) => void
  isAdmin: boolean
  onTransitionToMentorship?: (mentee: MenteeWithStats) => void
}) {
  const tabsRef = useRef<HTMLDivElement>(null)
  const [showOverflow, setShowOverflow] = useState(false)
  const [chatUnread, setChatUnread] = useState(0)
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => {
    function check() {
      const el = tabsRef.current
      if (!el) return
      setShowOverflow(el.scrollWidth > el.clientWidth + 2)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <Tabs defaultValue="info" className="flex flex-col h-full" onValueChange={setActiveTab}>
      <div className="relative mx-4 mt-3 sm:mx-6">
        <div
          ref={tabsRef}
          className="overflow-x-auto scrollbar-none"
          onScroll={() => {
            const el = tabsRef.current
            if (!el) return
            setShowOverflow(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
          }}
        >
          <TabsList className="inline-flex items-center gap-1 border-b border-border min-w-max h-auto rounded-none bg-transparent p-0">
            {[
              { value: 'info', label: 'Info' },
              { value: 'action-plan', label: 'Plano' },
              { value: 'acompanhamento', label: 'Acompanhamento' },
              { value: 'engajamento', label: 'Engajamento' },
              { value: 'historico', label: 'Histórico' },
              { value: 'intensivo', label: 'Intensivo' },
              { value: 'chat', label: 'Chat' },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="whitespace-nowrap rounded-none border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-accent data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {tab.value === 'chat' ? (
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Chat
                    {chatUnread > 0 && (
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                        {chatUnread}
                      </span>
                    )}
                  </span>
                ) : (
                  tab.label
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {showOverflow && (
          <button
            type="button"
            className="absolute right-0 top-0 bottom-0 flex items-center cursor-pointer z-10"
            onClick={() => {
              const el = tabsRef.current
              if (el) el.scrollBy({ left: 150, behavior: 'smooth' })
            }}
          >
            <div className="w-10 h-full bg-gradient-to-l from-background to-transparent" />
            <ChevronRight size={16} className="text-muted-foreground -ml-5 animate-pulse" />
          </button>
        )}
      </div>
      <ScrollArea className={`flex-1 px-4 py-4 sm:px-6 lg:px-8 ${activeTab === 'chat' ? 'hidden' : ''}`}>
        <TabsContent value="info"><ErrorBoundary>
          <TabInfo
            mentee={mentee}
            editing={editing}
            setEditing={setEditing}
            onMenteeUpdated={onMenteeUpdated}
            isAdmin={isAdmin}
            onTransitionToMentorship={onTransitionToMentorship}
          />
        </ErrorBoundary></TabsContent>
        <TabsContent value="action-plan"><ErrorBoundary><TabActionPlan mentee={mentee} /></ErrorBoundary></TabsContent>
        <TabsContent value="acompanhamento"><ErrorBoundary><TabAcompanhamento menteeId={mentee.id} /></ErrorBoundary></TabsContent>
        <TabsContent value="engajamento"><ErrorBoundary><TabEngajamento menteeId={mentee.id} mentee={mentee} /></ErrorBoundary></TabsContent>
        <TabsContent value="historico"><ErrorBoundary><TabHistorico menteeId={mentee.id} /></ErrorBoundary></TabsContent>
        <TabsContent value="intensivo"><ErrorBoundary><TabIntensivo menteeId={mentee.id} /></ErrorBoundary></TabsContent>
      </ScrollArea>
      {/* Chat tab — outside ScrollArea (manages its own scroll) */}
      <TabsContent value="chat" className={`flex-1 overflow-hidden ${activeTab !== 'chat' ? 'hidden' : ''}`}>
        <ErrorBoundary><TabChat
          menteeId={mentee.id}
            menteePhone={mentee.phone}
            menteeName={mentee.full_name}
            specialistId={mentee.created_by}
            onUnreadCountChange={setChatUnread}
          /></ErrorBoundary>
        </TabsContent>
    </Tabs>
  )
}

// ─── Contact row with colored icon ───
function ContactRow({ icon: Icon, label, value, href, color, bg }: {
  icon: React.ElementType; label: string; value: string; href?: string; color: string; bg: string
}) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className={`rounded-md p-1 ${bg}`}>
        <Icon className={`h-3 w-3 ${color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] text-muted-foreground/70 leading-none">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[13px] text-accent hover:underline truncate block leading-tight">{value}</a>
        ) : (
          <p className="text-[13px] text-foreground truncate leading-tight">{value}</p>
        )}
      </div>
    </div>
  )
}

// ─── Metric box for performance data ───
function MetricBox({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-md border border-border p-2 text-center ${highlight ? 'bg-accent/5 border-accent/20' : 'bg-card'}`}>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      <p className={`font-heading text-sm font-bold tabular leading-tight mt-0.5 ${highlight ? 'text-accent' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  )
}

// ─── Format BRL currency ───
function formatBRL(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

// ─── Tab 1: Info Geral ───
function TabInfo({ mentee, editing, setEditing, onMenteeUpdated, isAdmin, onTransitionToMentorship }: {
  mentee: MenteeWithStats
  editing: boolean
  setEditing: (v: boolean) => void
  onMenteeUpdated?: (mentee: MenteeWithStats) => void
  isAdmin: boolean
  onTransitionToMentorship?: (mentee: MenteeWithStats) => void
}) {
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    full_name: mentee.full_name,
    phone: mentee.phone,
    email: mentee.email ?? '',
    instagram: mentee.instagram ?? '',
    city: mentee.city ?? '',
    state: mentee.state ?? '',
    birth_date: mentee.birth_date ?? '',
    product_name: mentee.product_name,
    start_date: mentee.start_date,
    end_date: mentee.end_date ?? '',
    priority_level: mentee.priority_level,
    cpf: mentee.cpf ?? '',
    has_partner: mentee.has_partner,
    partner_name: mentee.partner_name ?? '',
    seller_name: mentee.seller_name ?? '',
    funnel_origin: mentee.funnel_origin ?? '',
    status: mentee.status,
  })

  function resetForm() {
    setForm({
      full_name: mentee.full_name,
      phone: mentee.phone,
      email: mentee.email ?? '',
      instagram: mentee.instagram ?? '',
      city: mentee.city ?? '',
      state: mentee.state ?? '',
      birth_date: mentee.birth_date ?? '',
      product_name: mentee.product_name,
      start_date: mentee.start_date,
      end_date: mentee.end_date ?? '',
      priority_level: mentee.priority_level,
      cpf: mentee.cpf ?? '',
      has_partner: mentee.has_partner,
      partner_name: mentee.partner_name ?? '',
      seller_name: mentee.seller_name ?? '',
      funnel_origin: mentee.funnel_origin ?? '',
      status: mentee.status,
    })
  }

  async function handleSave() {
    setSaving(true)
    const result = await updateMentee(mentee.id, {
      full_name: form.full_name,
      phone: form.phone,
      email: form.email || null,
      instagram: form.instagram || null,
      city: form.city || null,
      state: form.state || null,
      birth_date: form.birth_date || null,
      product_name: form.product_name,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      priority_level: form.priority_level,
      cpf: form.cpf || null,
      has_partner: form.has_partner,
      partner_name: form.partner_name || null,
      seller_name: form.seller_name || null,
      funnel_origin: form.funnel_origin || null,
      status: form.status,
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Salvo')
      setEditing(false)
      onMenteeUpdated?.({ ...mentee, ...form, email: form.email || null, instagram: form.instagram || null, city: form.city || null, state: form.state || null, birth_date: form.birth_date || null, end_date: form.end_date || null, cpf: form.cpf || null, partner_name: form.partner_name || null, seller_name: form.seller_name || null, funnel_origin: form.funnel_origin || null })
    }
  }

  const instHandle = (editing ? form.instagram : mentee.instagram)?.replace(/^@/, '') || null

  // ─── Edit mode ───
  if (editing) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="grid gap-3">
          <EditField label="Nome" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <EditField label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <EditField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <EditField label="Instagram" value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} />
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Cidade" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <EditField label="Estado" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
          </div>
          <EditField label="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} />
          <EditField label="Produto" value={form.product_name} onChange={(v) => setForm({ ...form, product_name: v })} />
          <EditField label="Nascimento" value={form.birth_date} onChange={(v) => setForm({ ...form, birth_date: v })} type="date" />
          <EditField label="Início" value={form.start_date ?? ''} onChange={(v) => setForm({ ...form, start_date: v })} type="date" />
          <EditField label="Término" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} type="date" />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nível de prioridade</Label>
            <Select value={String(form.priority_level)} onValueChange={(v) => setForm({ ...form, priority_level: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>P{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <EditField label="Vendedor" value={form.seller_name} onChange={(v) => setForm({ ...form, seller_name: v })} />
          <EditField label="Funil" value={form.funnel_origin} onChange={(v) => setForm({ ...form, funnel_origin: v })} />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.has_partner}
              onChange={(e) => setForm({ ...form, has_partner: e.target.checked })}
              className="rounded border-border"
            />
            <Label className="text-sm">Tem sócio</Label>
          </div>
          {form.has_partner && (
            <EditField label="Nome do sócio" value={form.partner_name} onChange={(v) => setForm({ ...form, partner_name: v })} />
          )}
        </div>
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button onClick={handleSave} disabled={saving} size="sm" className="bg-gradient-to-r from-accent to-accent/80 text-white">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setEditing(false); resetForm() }}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  // ─── View mode — premium fullscreen layout v2 ───

  const statusLabel = mentee.status === 'ativo' ? 'Ativo' : mentee.status === 'cancelado' ? 'Cancelado' : mentee.status === 'concluido' ? 'Concluído' : mentee.status
  const statusColor = mentee.status === 'ativo' ? 'bg-success/10 text-success border-success/20' : mentee.status === 'cancelado' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-info/10 text-info border-info/20'

  const hasCloserData = mentee.niche || mentee.closer_name || mentee.main_pain || mentee.main_difficulty
  const hasMetrics = mentee.metrics_updated_at
  const hasMentoriaDetails = mentee.end_date || mentee.seller_name || mentee.funnel_origin || mentee.source || mentee.has_partner

  return (
    <div className="animate-fade-in space-y-5">
      {/* ── Summary strip — only essential badges ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusColor}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${mentee.status === 'ativo' ? 'bg-success' : mentee.status === 'cancelado' ? 'bg-destructive' : 'bg-info'}`} />
          {statusLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] text-muted-foreground">
          <Star className="h-3 w-3" /> Fit <ClienteFitToggle menteeId={mentee.id} initialValue={mentee.cliente_fit} />
        </span>
        {mentee.contract_validity && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> {mentee.contract_validity}
          </span>
        )}
        {isAdmin && mentee.kanban_type === 'initial' && onTransitionToMentorship && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTransitionToMentorship(mentee)}
            className="ml-auto h-7 text-[11px] border-accent/30 text-accent hover:bg-accent/5"
          >
            Enviar para Mentoria <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </div>

      {/* ── Main layout: Contato + Metrics (left) | Mentoria + Info Pessoais + Observações (right) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Left: Contact + Metrics stacked */}
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
              <Phone className="h-3.5 w-3.5 text-accent" />
              <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Contato</h3>
            </div>
            <div className="px-3 py-2 space-y-0">
              {mentee.phone && <ContactRow icon={Phone} label="Telefone" value={mentee.phone} color="text-accent" bg="bg-accent/10" />}
              {mentee.email && <ContactRow icon={Mail} label="Email" value={mentee.email} color="text-info" bg="bg-info/10" />}
              {instHandle && <ContactRow icon={AtSign} label="Instagram" value={`@${instHandle}`} href={`https://instagram.com/${instHandle}`} color="text-pink-500" bg="bg-pink-500/10" />}
              {(mentee.city || mentee.state) && <ContactRow icon={MapPin} label="Local" value={[mentee.city, mentee.state].filter(Boolean).join(', ')} color="text-warning" bg="bg-warning/10" />}
              {mentee.cpf && <ContactRow icon={Shield} label="CPF" value={mentee.cpf} color="text-muted-foreground" bg="bg-muted" />}
              {mentee.birth_date && <ContactRow icon={Calendar} label="Nascimento" value={formatDateBR(mentee.birth_date)} color="text-muted-foreground" bg="bg-muted" />}
            </div>
          </div>

          {/* Performance (Bethel Metrics) — fills the space below contact */}
          {hasMetrics ? (
            <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-accent" />
                  <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Performance</h3>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(mentee.metrics_updated_at!).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <MetricBox label="Fat. atual" value={mentee.faturamento_atual != null ? formatBRL(mentee.faturamento_atual) : '—'} highlight />
                  <MetricBox label="Mês anterior" value={mentee.faturamento_mes_anterior != null ? formatBRL(mentee.faturamento_mes_anterior) : '—'} />
                  <MetricBox label="Antes mentoria" value={mentee.faturamento_antes_mentoria != null ? formatBRL(mentee.faturamento_antes_mentoria) : '—'} />
                  <MetricBox label="Ticket médio" value={mentee.ticket_medio != null ? formatBRL(mentee.ticket_medio) : '—'} />
                  <MetricBox label="Leads" value={mentee.total_leads ?? '—'} />
                  <MetricBox label="Vendas" value={mentee.total_vendas ?? '—'} />
                  <MetricBox label="Conversão" value={mentee.taxa_conversao != null ? `${mentee.taxa_conversao}%` : '—'} />
                  <MetricBox label="Dias acessou" value={mentee.dias_acessou_sistema ?? '—'} />
                </div>
                {mentee.funis_ativos && Array.isArray(mentee.funis_ativos) && (mentee.funis_ativos as Array<{nome: string}>).length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Funis ativos</p>
                    <div className="flex flex-wrap gap-1">
                      {(mentee.funis_ativos as Array<{id?: string; nome: string; slug?: string}>).map((f, i) => (
                        <Badge key={f.id ?? i} variant="muted" className="text-[10px]">{f.nome}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/50 bg-muted/5 px-3 py-2.5 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground/20 shrink-0" />
              <p className="text-[11px] text-muted-foreground/40">
                Métricas via Bethel Metrics (webhook semanal)
              </p>
            </div>
          )}
        </div>

        {/* Right: Mentoria + Info Pessoais + Observações stacked */}
        <div className="space-y-3">
          {/* Mentoria card */}
          <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-success/5 to-transparent">
              <Briefcase className="h-3.5 w-3.5 text-success" />
              <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Mentoria</h3>
            </div>
            <div className="px-3 py-2 space-y-0">
              {mentee.end_date && <ContactRow icon={Calendar} label="Término" value={formatDateBR(mentee.end_date)} color="text-info" bg="bg-info/10" />}
              {mentee.seller_name && <ContactRow icon={Users} label="Vendedor" value={mentee.seller_name} color="text-success" bg="bg-success/10" />}
              {mentee.funnel_origin && <ContactRow icon={Target} label="Funil" value={mentee.funnel_origin} color="text-warning" bg="bg-warning/10" />}
              {mentee.has_partner && <ContactRow icon={Users} label="Sócio" value={mentee.partner_name || 'Sim'} color="text-accent" bg="bg-accent/10" />}
              {mentee.source && <ContactRow icon={Target} label="Origem" value={mentee.source} color="text-muted-foreground" bg="bg-muted" />}
              {!hasMentoriaDetails && (
                <div className="py-2 text-center">
                  <p className="text-[11px] text-muted-foreground/50">Sem dados adicionais</p>
                </div>
              )}
            </div>
          </div>

          {/* Info Pessoais card */}
          <PersonalTagsCard menteeId={mentee.id} initialTags={mentee.personal_tags ?? []} />

          {/* Observações card */}
          <NotesCard menteeId={mentee.id} initialNotes={mentee.notes ?? ''} />
        </div>
      </div>

      {/* ── Closer / Venda (full width) — only when data exists ── */}
      {hasCloserData && (
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-warning/5 to-transparent">
            <Mic className="h-3.5 w-3.5 text-warning" />
            <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Closer / Venda</h3>
          </div>
          <div className="px-3 py-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0">
              {mentee.closer_name && <ContactRow icon={Users} label="Closer" value={mentee.closer_name} color="text-warning" bg="bg-warning/10" />}
              {mentee.niche && <ContactRow icon={Target} label="Nicho" value={mentee.niche} color="text-accent" bg="bg-accent/10" />}
              {mentee.main_pain && <ContactRow icon={TrendingUp} label="Dor principal" value={mentee.main_pain} color="text-destructive" bg="bg-destructive/10" />}
              {mentee.main_difficulty && <ContactRow icon={Shield} label="Dificuldade" value={mentee.main_difficulty} color="text-info" bg="bg-info/10" />}
            </div>
            {mentee.transcription && (
              <div className="pt-1.5 mt-1.5 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground mb-1">Transcrição</p>
                <div className="rounded bg-muted/50 p-2 text-xs text-foreground max-h-20 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {mentee.transcription}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Personal Tags Card ───
function PersonalTagsCard({ menteeId, initialTags }: { menteeId: string; initialTags: string[] }) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function saveTags(newTags: string[]) {
    setSaving(true)
    await supabase.from('mentees').update({ personal_tags: newTags }).eq('id', menteeId)
    setSaving(false)
  }

  function handleAdd() {
    const tag = input.trim()
    if (!tag || tags.includes(tag)) return
    const newTags = [...tags, tag]
    setTags(newTags)
    setInput('')
    saveTags(newTags)
  }

  function handleRemove(tag: string) {
    const newTags = tags.filter((t) => t !== tag)
    setTags(newTags)
    saveTags(newTags)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
        <Users className="h-3.5 w-3.5 text-accent" />
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Informações Pessoais</h3>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
      </div>
      <div className="p-3 space-y-2.5">
        <div className="flex flex-wrap gap-1.5 min-h-[32px]">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2.5 py-0.5 text-[11px] font-medium text-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemove(tag)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
          {tags.length === 0 && (
            <p className="text-[11px] text-muted-foreground/40 italic">Adicione informações pessoais abaixo</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Casado, 2 filhos, Futebol..."
            className="h-7 text-xs"
          />
          <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" onClick={handleAdd} disabled={!input.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Notes Card ───
function NotesCard({ menteeId, initialNotes }: { menteeId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  function handleChange(value: string) {
    setNotes(value)
    // Auto-save with debounce
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      setSaving(true)
      await supabase.from('mentees').update({ notes: value }).eq('id', menteeId)
      setSaving(false)
    }, 800)
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-warning/5 to-transparent">
        <Pencil className="h-3.5 w-3.5 text-warning" />
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Observações</h3>
        <span className="text-[9px] text-muted-foreground/40 ml-auto">{saving ? 'Salvando...' : 'Auto-save'}</span>
      </div>
      <div className="p-3">
        <Textarea
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Anotações sobre o mentorado..."
          className="min-h-[80px] text-xs resize-none border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
        />
      </div>
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ClienteFitToggle({ menteeId, initialValue }: { menteeId: string; initialValue: boolean }) {
  const [fit, setFit] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function handleToggle() {
    setSaving(true)
    const newValue = !fit
    setFit(newValue)
    await toggleClienteFit(menteeId, newValue)
    setSaving(false)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fit ? 'bg-warning' : 'bg-muted'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${fit ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}


// ─── Tab 2: Plano de Ação ───

const ACTION_PLAN_LABELS: Record<string, string> = {
  endereco_completo: 'Endereço completo',
  email: 'Email',
  instagram: 'Instagram',
  cidade: 'Cidade',
  estado: 'Estado',
  nome_empresa: 'Nome da empresa',
  nicho: 'Nicho',
  num_colaboradores: 'Número de colaboradores',
  como_nos_conheceu: 'Por onde nos conheceu',
  motivacao_elite_premium: 'Por que decidiu entrar na Elite Premium',
  expectativas_resultados: 'Expectativas de resultado',
  atuacao_profissional: 'Atuação profissional',
  tempo_atuacao: 'Tempo de atuação',
  produtos_servicos: 'Principais produtos/serviços',
  funis_venda: 'Funis de venda ativos',
  processo_venda: 'Processo de venda',
  faturamento_mes1: 'Faturamento último mês',
  faturamento_mes2: 'Faturamento 2 meses atrás',
  faturamento_mes3: 'Faturamento 3 meses atrás',
  faturamento_medio: 'Faturamento médio',
  resultado_funis: 'Resultado por funil',
  erros_identificados: 'Erros identificados',
  desafios_funis: 'Principais desafios',
  funis_testados: 'Funis testados sem resultado',
  estrutura_comercial: 'Estrutura comercial',
  estrutura_marketing: 'Estrutura de marketing',
  entrega_produto: 'Entrega do produto/serviço',
  estrutura_gestao: 'Estrutura de gestão',
  equipe: 'Equipe',
  momento_negocio: 'Momento do negócio',
  objetivos_urgentes: 'Objetivos urgentes',
  visao_futuro: 'Visão de futuro (6m, 1a, 5a)',
}

const PILL_KEYS = new Set(['como_nos_conheceu'])
const CURRENCY_KEYS = new Set(['faturamento_mes1', 'faturamento_mes2', 'faturamento_mes3', 'faturamento_medio'])

function ActionPlanResponseView({ data }: { data: Record<string, unknown> }) {
  const keys = Object.keys(ACTION_PLAN_LABELS)

  return (
    <div className="space-y-0 divide-y divide-border/60">
      {keys.map((key) => {
        const value = data[key]
        if (value === undefined || value === null || value === '' || value === 0) return null
        const label = ACTION_PLAN_LABELS[key]
        const isPill = PILL_KEYS.has(key)
        const isCurrency = CURRENCY_KEYS.has(key)

        return (
          <div key={key} className="py-4 first:pt-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              {label}
            </p>
            {isPill && Array.isArray(value) ? (
              <div className="flex flex-wrap gap-1.5">
                {value.map((v: string) => (
                  <span key={v} className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">{v}</span>
                ))}
              </div>
            ) : isCurrency ? (
              <p className="text-sm text-foreground font-semibold tabular">R$ {(Number(value) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap">{String(value)}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TabActionPlan({ mentee }: { mentee: MenteeWithStats }) {
  const [token, setToken] = useState<string | null>(null)
  const [plan, setPlan] = useState<ActionPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('action_plans')
      .select('*')
      .eq('mentee_id', mentee.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setPlan(data) })
  }, [mentee.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerateLink() {
    setLoading(true)
    const result = await generateActionPlanLink(mentee.id)
    if (result.token) setToken(result.token)
    setLoading(false)
  }

  async function handleCopyLink() {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleExportPdf() {
    setExporting(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: html2canvas } = await import('html2canvas')

      const el = document.getElementById('action-plan-content')
      if (!el) return

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })

      const imgWidth = 190
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pdf = new jsPDF('p', 'mm', 'a4')

      // Header
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text(mentee.full_name, 10, 15)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(100, 100, 100)
      pdf.text(`${mentee.product_name ?? ''} — Preenchido em ${plan?.submitted_at ? new Date(plan.submitted_at).toLocaleDateString('pt-BR') : '—'}`, 10, 22)
      pdf.setTextColor(0, 0, 0)

      const pageHeight = pdf.internal.pageSize.getHeight()
      const startY = 28
      let heightLeft = imgHeight
      let position = startY

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight)
      heightLeft -= (pageHeight - startY)

      while (heightLeft > 0) {
        position = position - pageHeight + startY
        pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Footer on every page
      const totalPages = pdf.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor(150, 150, 150)
        pdf.text('Bethel CS — Confidencial', 10, pageHeight - 8)
      }

      pdf.save(`plano-acao-${mentee.full_name.replace(/\s+/g, '-').toLowerCase()}.pdf`)
    } catch {
      // silently fail
    } finally {
      setExporting(false)
    }
  }

  const link = token
    ? `${window.location.origin}/form/action-plan/${token}`
    : null

  const planData = plan?.data as Record<string, unknown> | null

  return (
    <div className="space-y-4 animate-fade-in">
      {plan?.submitted_at ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="success">
              Preenchido em {new Date(plan.submitted_at).toLocaleDateString('pt-BR')}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPdf}
              disabled={exporting}
              className="text-xs gap-1.5"
            >
              <FileDown className="h-3.5 w-3.5" />
              {exporting ? 'Gerando...' : 'Exportar PDF'}
            </Button>
          </div>
          <div
            id="action-plan-content"
            className="rounded-lg bg-white p-5"
          >
            {planData && <ActionPlanResponseView data={planData} />}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Gere o link para o mentorado preencher o plano de ação.
          </p>
          <Button onClick={handleGenerateLink} disabled={loading} variant="outline">
            <Link2 className="mr-2 h-4 w-4" />
            {loading ? 'Gerando...' : 'Gerar Link'}
          </Button>
          {link && (
            <div className="rounded-md border border-border bg-card p-3">
              <p className="label-xs mb-2">Link do formulário</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <Link2 className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="text-sm text-foreground font-medium truncate">
                    cs.bethelapps.com/plano/{token?.slice(0, 8)}...
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={copied ? 'default' : 'outline'}
                  onClick={handleCopyLink}
                  className="shrink-0 text-xs gap-1.5"
                >
                  {copied ? (
                    <><span className="text-xs">Copiado!</span></>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copiar</>
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Envie este link para o mentorado preencher o plano de ação</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Acompanhamento (unified grid) ───
function TabAcompanhamento({ menteeId }: { menteeId: string }) {
  const [stats, setStats] = useState({ indications: 0, converted: 0, convertedValue: 0, revenue: 0, testimonials: 0, sessions: 0, extras: 0 })
  const supabase = createClient()

  useEffect(() => {
    async function fetchStats() {
      const [{ data: ind }, { data: rev }, { data: test }, { data: sess }, { data: ext }] = await Promise.all([
        supabase.from('indications').select('id, converted, converted_value').eq('mentee_id', menteeId),
        supabase.from('revenue_records').select('sale_value').eq('mentee_id', menteeId),
        supabase.from('testimonials').select('id').eq('mentee_id', menteeId),
        supabase.from('individual_sessions').select('id').eq('mentee_id', menteeId),
        supabase.from('extra_deliveries').select('id').eq('mentee_id', menteeId),
      ])
      setStats({
        indications: ind?.length ?? 0,
        converted: ind?.filter((i) => i.converted).length ?? 0,
        convertedValue: ind?.filter((i) => i.converted).reduce((s, i) => s + Number(i.converted_value ?? 0), 0) ?? 0,
        revenue: rev?.reduce((s, r) => s + Number(r.sale_value), 0) ?? 0,
        testimonials: test?.length ?? 0,
        sessions: sess?.length ?? 0,
        extras: ext?.length ?? 0,
      })
    }
    fetchStats()
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary metrics bar */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        <div className="rounded-lg border border-border bg-card p-2.5 text-center">
          <p className="text-lg font-bold tabular text-foreground">{stats.indications}</p>
          <p className="text-[10px] text-muted-foreground">Indicações</p>
          {stats.converted > 0 && <p className="text-[10px] text-success font-medium">{stats.converted} converteram</p>}
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5 text-center">
          <p className="text-lg font-bold tabular text-success">R$ {stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] text-muted-foreground">Receita</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5 text-center">
          <p className="text-lg font-bold tabular text-foreground">{stats.testimonials}</p>
          <p className="text-[10px] text-muted-foreground">Depoimentos</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5 text-center">
          <p className="text-lg font-bold tabular text-foreground">{stats.sessions}</p>
          <p className="text-[10px] text-muted-foreground">Sessões</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-2.5 text-center">
          <p className="text-lg font-bold tabular text-foreground">{stats.extras}</p>
          <p className="text-[10px] text-muted-foreground">Extras</p>
        </div>
      </div>

      {/* Cards grid — all same width */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <CardIndicacoes menteeId={menteeId} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <TabRevenue menteeId={menteeId} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <CardIndividualSessions menteeId={menteeId} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <CardExtraDeliveries menteeId={menteeId} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <TabTestimonials menteeId={menteeId} />
        </div>
      </div>
    </div>
  )
}

// ─── Card: Individual Sessions (Gap 2) ───
function CardIndividualSessions({ menteeId }: { menteeId: string }) {
  const [items, setItems] = useState<Database['public']['Tables']['individual_sessions']['Row'][]>([])
  const [showForm, setShowForm] = useState(false)
  const [sessionDate, setSessionDate] = useState('')
  const [duration, setDuration] = useState('')
  const [specialist, setSpecialist] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase.from('individual_sessions').select('*').eq('mentee_id', menteeId)
      .order('session_date', { ascending: false }).then(({ data }) => { if (data) setItems(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [fetchData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    await addIndividualSession(menteeId, { session_date: sessionDate, duration_minutes: duration ? parseInt(duration) : undefined, specialist_name: specialist || undefined, notes: notes || undefined })
    setSessionDate(''); setDuration(''); setSpecialist(''); setNotes(''); setShowForm(false); setLoading(false); fetchData()
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 -mx-4 -mt-4 px-4 py-3 border-b border-border bg-muted/30">
        <Phone className="h-4 w-4 text-info" />
        <h3 className="font-heading font-semibold text-sm">Mentoria Individual</h3>
        <Badge variant="muted" className="text-[10px] ml-auto">{items.length}</Badge>
      </div>
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}><Plus className="mr-1 h-3 w-3" /> Registrar</Button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Data *</Label><Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required /></div>
            <div className="space-y-1"><Label>Duração (min)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Especialista</Label><Input value={specialist} onChange={(e) => setSpecialist(e.target.value)} placeholder="Ex: Ericles" /></div>
          <div className="space-y-1"><Label>Observações</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button type="submit" size="sm" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
        </form>
      )}
      {items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Phone className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma sessão registrada</p>
          <Button size="sm" variant="ghost" className="mt-2 text-xs text-accent" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" /> Registrar primeira</Button>
        </div>
      )}
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{formatDateBR(item.session_date)}</span>
            {item.duration_minutes && <Badge variant="info" className="text-[10px]">{item.duration_minutes}min</Badge>}
          </div>
          {item.specialist_name && <p className="mt-1 text-foreground">{item.specialist_name}</p>}
          {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
        </div>
      ))}
    </div>
  )
}

// ─── Card: Extra Deliveries (Gap 3) ───
function CardExtraDeliveries({ menteeId }: { menteeId: string }) {
  const [items, setItems] = useState<Database['public']['Tables']['extra_deliveries']['Row'][]>([])
  const [showForm, setShowForm] = useState(false)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryType, setDeliveryType] = useState('outro')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase.from('extra_deliveries').select('*').eq('mentee_id', menteeId)
      .order('delivery_date', { ascending: false }).then(({ data }) => { if (data) setItems(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [fetchData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    await addExtraDelivery(menteeId, { delivery_date: deliveryDate, delivery_type: deliveryType, description: description || undefined })
    setDeliveryDate(''); setDeliveryType('outro'); setDescription(''); setShowForm(false); setLoading(false); fetchData()
  }

  const typeLabels: Record<string, string> = { call_individual: 'Call Individual', encontro_presencial: 'Encontro Presencial', outro: 'Outro' }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 -mx-4 -mt-4 px-4 py-3 border-b border-border bg-muted/30">
        <Star className="h-4 w-4 text-warning" />
        <h3 className="font-heading font-semibold text-sm">Entregas Extras</h3>
        <Badge variant="muted" className="text-[10px] ml-auto">{items.length}</Badge>
      </div>
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}><Plus className="mr-1 h-3 w-3" /> Registrar</Button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Data *</Label><Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} required /></div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={deliveryType} onValueChange={setDeliveryType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call_individual">Call Individual</SelectItem>
                  <SelectItem value="encontro_presencial">Encontro Presencial</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que aconteceu" /></div>
          <Button type="submit" size="sm" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
        </form>
      )}
      {items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Star className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma entrega extra</p>
          <Button size="sm" variant="ghost" className="mt-2 text-xs text-accent" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" /> Registrar primeira</Button>
        </div>
      )}
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex items-center justify-between">
            <Badge variant="info" className="text-[10px]">{typeLabels[item.delivery_type] || item.delivery_type}</Badge>
            <span className="text-xs text-muted-foreground">{formatDateBR(item.delivery_date)}</span>
          </div>
          {item.description && <p className="mt-1 text-foreground">{item.description}</p>}
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Receita Nova ───
function TabRevenue({ menteeId }: { menteeId: string }) {
  const [items, setItems] = useState<RevenueRecord[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [customProductName, setCustomProductName] = useState('')
  const [saleCents, setSaleCents] = useState(0)
  const [entryCents, setEntryCents] = useState(0)
  const [loading, setLoading] = useState(false)
  const [revenueType, setRevenueType] = useState<RevenueType>('crossell')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase
      .from('revenue_records')
      .select('*')
      .eq('mentee_id', menteeId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setItems(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProducts = useCallback(() => {
    supabase
      .from('products')
      .select('*')
      .order('name')
      .then(({ data }) => { if (data) setProducts(data) })
  }, [supabase])

  useEffect(() => { fetchData(); fetchProducts() }, [fetchData, fetchProducts])

  const totalRevenue = items.reduce((sum, r) => sum + Number(r.sale_value), 0)

  const resolvedProductName =
    selectedProduct === '__outro__'
      ? customProductName
      : products.find((p) => p.id === selectedProduct)?.name ?? ''

  function resetForm() {
    setSelectedProduct(''); setCustomProductName('')
    setSaleCents(0); setEntryCents(0); setRevenueType('crossell')
    setEditingId(null); setShowForm(false)
  }

  function handleEdit(item: RevenueRecord) {
    setRevenueType(item.revenue_type)
    const matchingProduct = products.find((p) => p.name === item.product_name)
    if (matchingProduct) {
      setSelectedProduct(matchingProduct.id)
      setCustomProductName('')
    } else {
      setSelectedProduct('__outro__')
      setCustomProductName(item.product_name)
    }
    setSaleCents(Math.round(Number(item.sale_value) * 100))
    setEntryCents(Math.round(Number(item.entry_value) * 100))
    setEditingId(item.id)
    setShowForm(true)
  }

  async function handleDelete(recordId: string) {
    setDeletingId(recordId)
    // Optimistically remove from UI
    setItems((prev) => prev.filter((i) => i.id !== recordId))

    const undoTimeout = setTimeout(async () => {
      await deleteRevenueRecord(recordId)
      setDeletingId(null)
      fetchData()
    }, 5000)

    toast('Registro excluído', {
      action: {
        label: 'Desfazer',
        onClick: () => {
          clearTimeout(undoTimeout)
          setDeletingId(null)
          fetchData() // Restore from DB
        },
      },
      duration: 5000,
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resolvedProductName) return
    setLoading(true)

    if (editingId) {
      await updateRevenueRecord(editingId, {
        product_name: resolvedProductName,
        sale_value: centsToDecimal(saleCents),
        entry_value: centsToDecimal(entryCents),
        revenue_type: revenueType,
      })
    } else {
      await addRevenueRecord(menteeId, {
        product_name: resolvedProductName,
        sale_value: centsToDecimal(saleCents),
        entry_value: centsToDecimal(entryCents),
        revenue_type: revenueType,
      })
    }

    setLoading(false)
    resetForm()
    fetchData()
  }

  return (
    <div className="p-4 space-y-4">
      {/* Card header */}
      <div className="flex items-center gap-2 -mx-4 -mt-4 px-4 py-3 border-b border-border bg-muted/30">
        <DollarSign className="h-4 w-4 text-success" />
        <h3 className="font-heading font-semibold text-sm">Receita</h3>
        <span className="text-xs font-medium text-success tabular ml-auto">
          R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(!showForm) }}>
          <Plus className="mr-1 h-3 w-3" /> Registrar
        </Button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <p className="label-xs">{editingId ? 'Editar registro' : 'Novo registro'}</p>
            {editingId && (
              <Button type="button" size="sm" variant="ghost" onClick={resetForm} className="text-xs text-muted-foreground">
                Cancelar edição
              </Button>
            )}
          </div>
          <div className="space-y-1">
            <Label>Produto *</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
                <SelectItem value="__outro__">Outro...</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedProduct === '__outro__' && (
            <div className="space-y-1">
              <Label htmlFor="rev-custom-product">Nome do produto *</Label>
              <Input
                id="rev-custom-product"
                value={customProductName}
                onChange={(e) => setCustomProductName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-1">
            <Label>Tipo *</Label>
            <Select value={revenueType} onValueChange={(v) => setRevenueType(v as RevenueType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crossell">Crossell</SelectItem>
                <SelectItem value="upsell">Upsell (Ascensão)</SelectItem>
                <SelectItem value="indicacao_perpetuo">Indicação Perpétuo</SelectItem>
                <SelectItem value="indicacao_intensivo">Indicação Intensivo</SelectItem>
                <SelectItem value="indicacao_encontro">Indicação Encontro Elite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="rev-sale">Valor de venda *</Label>
              <Input
                id="rev-sale"
                inputMode="numeric"
                value={saleCents > 0 ? `R$ ${formatCurrency(saleCents)}` : ''}
                placeholder="R$ 0,00"
                onChange={(e) => setSaleCents(parseCurrencyInput(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rev-entry">Valor de entrada *</Label>
              <Input
                id="rev-entry"
                inputMode="numeric"
                value={entryCents > 0 ? `R$ ${formatCurrency(entryCents)}` : ''}
                placeholder="R$ 0,00"
                onChange={(e) => setEntryCents(parseCurrencyInput(e.target.value))}
                required
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={loading || !resolvedProductName}>
            {loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
          </Button>
        </form>
      )}
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{item.product_name}</p>
              <Badge variant={item.revenue_type === 'upsell' ? 'accent' : 'info'} className="text-[10px]">
                {item.revenue_type === 'upsell' ? 'Upsell' : 'Crossell'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-success tabular">
                R$ {Number(item.sale_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <button
                type="button"
                onClick={() => handleEdit(item)}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground tabular">
            Entrada: R$ {Number(item.entry_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Card: Indicações CS ───
function CardIndicacoes({ menteeId }: { menteeId: string }) {
  // Indications state
  const [indications, setIndications] = useState<Indication[]>([])
  const [showIndForm, setShowIndForm] = useState(false)
  const [editingIndId, setEditingIndId] = useState<string | null>(null)
  const [indName, setIndName] = useState('')
  const [indPhone, setIndPhone] = useState('')
  const [indLoading, setIndLoading] = useState(false)
  const [confirmDeleteInd, setConfirmDeleteInd] = useState<string | null>(null)

  const supabase = createClient()

  const fetchAll = useCallback(() => {
    supabase.from('indications').select('*').eq('mentee_id', menteeId)
      .order('created_at', { ascending: false }).then(({ data }) => { if (data) setIndications(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── Indications handlers ───
  function openEditInd(ind: Indication) {
    setEditingIndId(ind.id); setIndName(ind.indicated_name); setIndPhone(ind.indicated_phone)
    setShowIndForm(true)
  }
  function resetIndForm() {
    setEditingIndId(null); setIndName(''); setIndPhone(''); setShowIndForm(false)
  }
  async function handleSubmitInd(e: React.FormEvent) {
    e.preventDefault(); setIndLoading(true)
    if (editingIndId) {
      await updateIndication(editingIndId, { indicated_name: indName, indicated_phone: indPhone })
    } else {
      await addIndication(menteeId, indName, indPhone)
    }
    resetIndForm(); setIndLoading(false); fetchAll()
  }
  async function handleDeleteInd(id: string) {
    setConfirmDeleteInd(null)
    setIndications((prev) => prev.filter((i) => i.id !== id))
    const undoTimeout = setTimeout(async () => { await deleteIndication(id); fetchAll() }, 5000)
    toast('Indicação excluída', { action: { label: 'Desfazer', onClick: () => { clearTimeout(undoTimeout); fetchAll() } }, duration: 5000 })
  }

  return (
    <div className="p-4 space-y-4">
      {/* Card header */}
      <div className="flex items-center gap-2 -mx-4 -mt-4 px-4 py-3 border-b border-border bg-muted/30">
        <Users className="h-4 w-4 text-accent" />
        <h3 className="font-heading font-semibold text-sm">Indicações</h3>
        <div className="flex items-center gap-1.5 ml-auto">
          {indications.filter((i) => i.converted).length > 0 && (
            <span className="text-[10px] text-success font-medium">{indications.filter((i) => i.converted).length} convertidas</span>
          )}
          <Badge variant="muted" className="text-[10px]">{indications.length}</Badge>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={() => { resetIndForm(); setShowIndForm(!showIndForm) }}>
          <Plus className="mr-1 h-3 w-3" /> Registrar indicação
        </Button>
      </div>

      <Dialog open={showIndForm} onOpenChange={(open) => { if (!open) resetIndForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIndId ? 'Editar indicação' : 'Nova indicação'}</DialogTitle>
            <DialogDescription>Registre uma indicação feita pelo mentorado.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitInd} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ind-name">Nome do indicado *</Label>
              <Input id="ind-name" value={indName} onChange={(e) => setIndName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ind-phone">Telefone *</Label>
              <Input id="ind-phone" value={indPhone} onChange={(e) => setIndPhone(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetIndForm}>Cancelar</Button>
              <Button type="submit" disabled={indLoading}>{indLoading ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {indications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Users className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma indicação registrada</p>
          <Button size="sm" variant="ghost" className="mt-2 text-xs text-accent" onClick={() => { resetIndForm(); setShowIndForm(true) }}>
            <Plus className="h-3 w-3 mr-1" /> Registrar primeira
          </Button>
        </div>
      )}
      {indications.map((item) => (
        <div key={item.id} className={`group rounded-lg border p-3 text-sm transition-colors hover:bg-muted/30 ${item.converted ? 'border-success/30 bg-success/5' : 'border-border bg-card'}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{item.indicated_name}</p>
                {item.converted && <Badge variant="success" className="text-[10px]">Converteu</Badge>}
              </div>
              <p className="text-muted-foreground">{item.indicated_phone}</p>
              {item.converted && item.converted_name && (
                <p className="text-xs text-success mt-1">Fechou: {item.converted_name} {item.converted_value ? `— R$ ${Number(item.converted_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!item.converted && (
                <Button size="sm" variant="ghost" className="h-7 text-[10px] text-success" onClick={async () => {
                  const name = window.prompt('Quem fechou?')
                  if (!name) return
                  const valueStr = window.prompt('Valor (ex: 5000)')
                  const value = valueStr ? parseFloat(valueStr) : undefined
                  await updateIndication(item.id, { converted: true, converted_name: name, converted_value: value, converted_at: new Date().toISOString().split('T')[0] })
                  fetchAll()
                }}>Converteu?</Button>
              )}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditInd(item)} aria-label="Editar"><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteInd(item.id)} aria-label="Excluir"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      <Dialog open={!!confirmDeleteInd} onOpenChange={() => setConfirmDeleteInd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir indicação?</DialogTitle><DialogDescription>Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteInd(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDeleteInd && handleDeleteInd(confirmDeleteInd)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tab: Intensivo ───
function TabIntensivo({ menteeId }: { menteeId: string }) {
  const [intensivos, setIntensivos] = useState<IntensivoRecord[]>([])

  // Indicação form state
  const [showIndForm, setShowIndForm] = useState(false)
  const [editingIndId, setEditingIndId] = useState<string | null>(null)
  const [indName, setIndName] = useState('')
  const [indPhone, setIndPhone] = useState('')
  const [indLoading, setIndLoading] = useState(false)

  // Participação form state
  const [showPartForm, setShowPartForm] = useState(false)
  const [editingPartId, setEditingPartId] = useState<string | null>(null)
  const [partDate, setPartDate] = useState('')
  const [partLoading, setPartLoading] = useState(false)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase.from('intensivo_records').select('*').eq('mentee_id', menteeId)
      .order('created_at', { ascending: false }).then(({ data }) => { if (data) setIntensivos(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  // Split records into two lists
  const indicacoes = intensivos.filter((r) => r.indication_name)
  const participacoes = intensivos.filter((r) => r.participated)

  // ─── Indicação handlers ───
  function resetIndForm() {
    setEditingIndId(null); setIndName(''); setIndPhone(''); setShowIndForm(false)
  }
  function openEditInd(rec: IntensivoRecord) {
    setEditingIndId(rec.id); setIndName(rec.indication_name || ''); setIndPhone(rec.indication_phone || '')
    setShowIndForm(true)
  }
  async function handleSubmitInd(e: React.FormEvent) {
    e.preventDefault(); setIndLoading(true)
    const data = { participated: false, indication_name: indName, indication_phone: indPhone || undefined }
    if (editingIndId) {
      await updateIntensivoRecord(editingIndId, data)
    } else {
      await addIntensivoRecord(menteeId, data)
    }
    resetIndForm(); setIndLoading(false); fetchData()
  }

  // ─── Participação handlers ───
  function resetPartForm() {
    setEditingPartId(null); setPartDate(''); setShowPartForm(false)
  }
  function openEditPart(rec: IntensivoRecord) {
    setEditingPartId(rec.id); setPartDate(rec.participation_date || '')
    setShowPartForm(true)
  }
  async function handleSubmitPart(e: React.FormEvent) {
    e.preventDefault(); setPartLoading(true)
    const data = { participated: true, participation_date: partDate || undefined }
    if (editingPartId) {
      await updateIntensivoRecord(editingPartId, data)
    } else {
      await addIntensivoRecord(menteeId, data)
    }
    resetPartForm(); setPartLoading(false); fetchData()
  }

  // ─── Delete handler ───
  async function handleDelete(id: string) {
    setConfirmDeleteId(null)
    setIntensivos((prev) => prev.filter((i) => i.id !== id))
    const undoTimeout = setTimeout(async () => { await deleteIntensivoRecord(id); fetchData() }, 5000)
    toast('Registro excluído', { action: { label: 'Desfazer', onClick: () => { clearTimeout(undoTimeout); fetchData() } }, duration: 5000 })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ═══ SEÇÃO 1: Indicação para o Intensivo ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-xs uppercase">Indicação para o Intensivo ({indicacoes.length})</p>
          <Button size="sm" variant="outline" onClick={() => { resetIndForm(); setShowIndForm(!showIndForm) }}>
            <Plus className="mr-1 h-3 w-3" /> Registrar
          </Button>
        </div>

        <Dialog open={showIndForm} onOpenChange={(open) => { if (!open) resetIndForm() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingIndId ? 'Editar indicação' : 'Nova indicação para o intensivo'}</DialogTitle>
              <DialogDescription>Registre uma indicação feita pelo mentorado para o intensivo.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitInd} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="int-ind-name">Nome do indicado *</Label>
                <Input id="int-ind-name" value={indName} onChange={(e) => setIndName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="int-ind-phone">Telefone</Label>
                <Input id="int-ind-phone" value={indPhone} onChange={(e) => setIndPhone(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetIndForm}>Cancelar</Button>
                <Button type="submit" disabled={indLoading}>{indLoading ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {indicacoes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma indicação registrada</p>
            <Button size="sm" variant="ghost" className="mt-2 text-xs text-accent" onClick={() => { resetIndForm(); setShowIndForm(true) }}>
              <Plus className="h-3 w-3 mr-1" /> Registrar primeira
            </Button>
          </div>
        )}
        {indicacoes.map((item) => (
          <div key={item.id} className={`group rounded-lg border p-3 text-sm transition-colors hover:bg-muted/30 ${item.converted ? 'border-success/30 bg-success/5' : 'border-border bg-card'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{item.indication_name}</p>
                  {item.converted && <Badge variant="success" className="text-[10px]">Converteu</Badge>}
                </div>
                {item.indication_phone && <p className="text-muted-foreground">{item.indication_phone}</p>}
                {item.converted && item.converted_name && (
                  <p className="text-xs text-success mt-1">Fechou: {item.converted_name} {item.converted_value ? `— R$ ${Number(item.converted_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!item.converted && (
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] text-success" onClick={async () => {
                    const name = window.prompt('Quem fechou?')
                    if (!name) return
                    const valueStr = window.prompt('Valor (ex: 5000)')
                    const value = valueStr ? parseFloat(valueStr) : undefined
                    await updateIntensivoRecord(item.id, { converted: true, converted_name: name, converted_value: value })
                    fetchData()
                  }}>Converteu?</Button>
                )}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditInd(item)} aria-label="Editar"><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteId(item.id)} aria-label="Excluir"><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Separator className="border-border/50" />

      {/* ═══ SEÇÃO 2: Participação do Intensivo ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-xs uppercase">Participação do Intensivo ({participacoes.length})</p>
          <Button size="sm" variant="outline" onClick={() => { resetPartForm(); setShowPartForm(!showPartForm) }}>
            <Plus className="mr-1 h-3 w-3" /> Registrar
          </Button>
        </div>

        <Dialog open={showPartForm} onOpenChange={(open) => { if (!open) resetPartForm() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPartId ? 'Editar participação' : 'Nova participação no intensivo'}</DialogTitle>
              <DialogDescription>Registre a participação do mentorado no intensivo.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitPart} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="int-part-date">Data de participação *</Label>
                <Input id="int-part-date" type="date" value={partDate} onChange={(e) => setPartDate(e.target.value)} required />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetPartForm}>Cancelar</Button>
                <Button type="submit" disabled={partLoading}>{partLoading ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {participacoes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma participação registrada</p>
            <Button size="sm" variant="ghost" className="mt-2 text-xs text-accent" onClick={() => { resetPartForm(); setShowPartForm(true) }}>
              <Plus className="h-3 w-3 mr-1" /> Registrar primeira
            </Button>
          </div>
        )}
        {participacoes.map((item) => (
          <div key={item.id} className="group rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/30">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="success">Participou</Badge>
                {item.participation_date && <span className="text-muted-foreground text-xs">{formatDateBR(item.participation_date)}</span>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPart(item)} aria-label="Editar"><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteId(item.id)} aria-label="Excluir"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Separator className="border-border/50" />

      {/* ═══ SEÇÃO 3: Encontro Presencial ═══ */}
      <CardPresentialEvents menteeId={menteeId} />

      {/* Confirm delete dialog (shared) */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir registro?</DialogTitle><DialogDescription>Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Card: Encontro Presencial (Gap 4) ───
function CardPresentialEvents({ menteeId }: { menteeId: string }) {
  const [items, setItems] = useState<Database['public']['Tables']['presential_events']['Row'][]>([])
  const [showForm, setShowForm] = useState(false)
  const [eventDate, setEventDate] = useState('')
  const [broughtGuest, setBroughtGuest] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [eventNotes, setEventNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase.from('presential_events').select('*').eq('mentee_id', menteeId)
      .order('event_date', { ascending: false }).then(({ data }) => { if (data) setItems(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [fetchData])

  function resetForm() { setEventDate(''); setBroughtGuest(false); setGuestName(''); setGuestPhone(''); setEventNotes(''); setShowForm(false) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    await addPresentialEvent(menteeId, {
      event_date: eventDate,
      brought_guest: broughtGuest,
      guest_name: broughtGuest ? guestName || undefined : undefined,
      guest_phone: broughtGuest ? guestPhone || undefined : undefined,
      notes: eventNotes || undefined,
    })
    resetForm(); setLoading(false); fetchData()
  }

  const totalGuests = items.filter((i) => i.brought_guest).length
  const totalConverted = items.filter((i) => i.converted).length
  const totalValue = items.reduce((s, i) => s + Number(i.converted_value ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-xs uppercase">Encontro Presencial ({items.length})</p>
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(!showForm) }}><Plus className="mr-1 h-3 w-3" /> Registrar</Button>
      </div>

      {items.length > 0 && (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{items.length} participações</span>
          <span>{totalGuests} convidados</span>
          <span className="text-success">{totalConverted} converteram</span>
          {totalValue > 0 && <span className="text-success font-medium">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Encontro Presencial</DialogTitle>
            <DialogDescription>Registre a participação no encontro presencial da mentoria.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1"><Label>Data do encontro *</Label><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pe-guest" checked={broughtGuest} onChange={(e) => setBroughtGuest(e.target.checked)} className="h-4 w-4 rounded border-input" />
              <Label htmlFor="pe-guest">Levou convidado</Label>
            </div>
            {broughtGuest && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Nome do convidado</Label><Input value={guestName} onChange={(e) => setGuestName(e.target.value)} /></div>
                <div className="space-y-1"><Label>Telefone</Label><Input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} /></div>
              </div>
            )}
            <div className="space-y-1"><Label>Observações</Label><Input value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Calendar className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Nenhum encontro registrado</p>
          <Button size="sm" variant="ghost" className="mt-2 text-xs text-accent" onClick={() => setShowForm(true)}><Plus className="h-3 w-3 mr-1" /> Registrar primeiro</Button>
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} className={`group rounded-lg border p-3 text-sm transition-colors hover:bg-muted/30 ${item.converted ? 'border-success/30 bg-success/5' : 'border-border bg-card'}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatDateBR(item.event_date)}</span>
                {item.brought_guest && <Badge variant="info" className="text-[10px]">Convidado</Badge>}
                {item.converted && <Badge variant="success" className="text-[10px]">Converteu</Badge>}
              </div>
              {item.guest_name && <p className="mt-1 text-foreground">Convidado: {item.guest_name} {item.guest_phone ? `— ${item.guest_phone}` : ''}</p>}
              {item.converted && item.converted_name && (
                <p className="text-xs text-success mt-0.5">Fechou: {item.converted_name} {item.converted_value ? `— R$ ${Number(item.converted_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}</p>
              )}
              {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
            </div>
            <div className="flex items-center gap-1">
              {item.brought_guest && !item.converted && (
                <Button size="sm" variant="ghost" className="h-7 text-[10px] text-success" onClick={async () => {
                  const name = window.prompt('Quem fechou?')
                  if (!name) return
                  const valueStr = window.prompt('Valor (ex: 5000)')
                  const value = valueStr ? parseFloat(valueStr) : undefined
                  await updatePresentialEvent(item.id, { converted: true, converted_name: name, converted_value: value })
                  fetchData()
                }}>Converteu?</Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Engajamento (dashboard com métricas automáticas) ───
function TabEngajamento({ menteeId, mentee }: { menteeId: string; mentee: MenteeWithStats }) {
  const [engagements, setEngagements] = useState<EngagementRecord[]>([])
  const [lastMsgDate, setLastMsgDate] = useState<string | null>(null)
  const [wppStats, setWppStats] = useState({ sent: 0, received: 0 })
  const [callStats, setCallStats] = useState({ count: 0, minutes: 0 })
  const supabase = createClient()

  useEffect(() => {
    // Fetch engagement records
    supabase.from('engagement_records').select('*').eq('mentee_id', menteeId)
      .order('recorded_at', { ascending: false })
      .then(({ data }) => { if (data) setEngagements(data) })

    // Last outgoing message
    supabase.from('wpp_messages').select('sent_at').eq('mentee_id', menteeId).eq('direction', 'outgoing')
      .order('sent_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setLastMsgDate(data[0].sent_at) })

    // WhatsApp counts
    supabase.from('wpp_messages').select('direction').eq('mentee_id', menteeId)
      .then(({ data }) => {
        if (!data) return
        const sent = data.filter((m) => m.direction === 'outgoing').length
        const received = data.filter((m) => m.direction === 'incoming').length
        setWppStats({ sent, received })
      })

    // Call stats
    supabase.from('call_records').select('duration_seconds').eq('mentee_id', menteeId)
      .then(({ data }) => {
        if (!data) return
        setCallStats({
          count: data.length,
          minutes: Math.round(data.reduce((s, c) => s + Number(c.duration_seconds ?? 0), 0) / 60),
        })
      })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const daysSinceContact = lastMsgDate
    ? Math.floor((Date.now() - new Date(lastMsgDate).getTime()) / 86400000)
    : null

  const engAulas = engagements.filter((e) => e.type === 'aula').reduce((s, e) => s + Number(e.value), 0)
  const engLives = engagements.filter((e) => e.type === 'live').reduce((s, e) => s + Number(e.value), 0)
  const engEventos = engagements.filter((e) => e.type === 'evento').reduce((s, e) => s + Number(e.value), 0)

  const fatAtual = mentee.faturamento_atual ?? 0
  const fatAntes = mentee.faturamento_antes_mentoria ?? 0
  const crescimento = fatAntes > 0 ? Math.round(((fatAtual - fatAntes) / fatAntes) * 100) : 0

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Health indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`rounded-lg border p-3 text-center ${daysSinceContact != null && daysSinceContact > 7 ? 'border-destructive/30 bg-destructive/5' : daysSinceContact != null && daysSinceContact > 3 ? 'border-warning/30 bg-warning/5' : 'border-border bg-card'}`}>
          <p className={`text-2xl font-bold tabular ${daysSinceContact != null && daysSinceContact > 7 ? 'text-destructive' : daysSinceContact != null && daysSinceContact > 3 ? 'text-warning' : 'text-foreground'}`}>
            {daysSinceContact != null ? `${daysSinceContact}d` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Último contato</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold tabular text-foreground">{engAulas}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Acessos área membros</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <p className="text-2xl font-bold tabular text-foreground">{engLives}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Presenças ao vivo</p>
        </div>
        <div className={`rounded-lg border p-3 text-center ${crescimento > 0 ? 'border-success/30 bg-success/5' : crescimento < 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}>
          <p className={`text-2xl font-bold tabular ${crescimento > 0 ? 'text-success' : crescimento < 0 ? 'text-destructive' : 'text-foreground'}`}>
            {crescimento !== 0 ? `${crescimento > 0 ? '+' : ''}${crescimento}%` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Crescimento fat.</p>
        </div>
      </div>

      {/* Detailed metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* WhatsApp */}
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-success/5 to-transparent">
            <MessageSquare className="h-3.5 w-3.5 text-success" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wide">WhatsApp</h3>
          </div>
          <div className="p-3 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-lg font-bold tabular text-foreground">{wppStats.sent}</p>
              <p className="text-[10px] text-muted-foreground">Enviadas</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular text-foreground">{wppStats.received}</p>
              <p className="text-[10px] text-muted-foreground">Recebidas</p>
            </div>
          </div>
        </div>

        {/* Ligações */}
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-info/5 to-transparent">
            <Phone className="h-3.5 w-3.5 text-info" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wide">Ligações</h3>
          </div>
          <div className="p-3 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-lg font-bold tabular text-foreground">{callStats.count}</p>
              <p className="text-[10px] text-muted-foreground">Realizadas</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular text-foreground">{callStats.minutes}min</p>
              <p className="text-[10px] text-muted-foreground">Tempo total</p>
            </div>
          </div>
        </div>

        {/* Participação */}
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
            <TrendingUp className="h-3.5 w-3.5 text-accent" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wide">Participação</h3>
          </div>
          <div className="p-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold tabular text-foreground">{engAulas}</p>
              <p className="text-[10px] text-muted-foreground">Área membros</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular text-foreground">{engLives}</p>
              <p className="text-[10px] text-muted-foreground">Lives</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular text-foreground">{engEventos}</p>
              <p className="text-[10px] text-muted-foreground">Eventos</p>
            </div>
          </div>
        </div>

        {/* Faturamento */}
        <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-warning/5 to-transparent">
            <DollarSign className="h-3.5 w-3.5 text-warning" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wide">Faturamento</h3>
          </div>
          <div className="p-3 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-lg font-bold tabular text-foreground">
                {fatAtual > 0 ? `R$ ${fatAtual.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">Atual</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular text-foreground">
                {fatAntes > 0 ? `R$ ${fatAntes.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">Antes mentoria</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Histórico (timeline unificada) ───
type TimelineEvent = {
  id: string
  type: 'message' | 'call' | 'revenue' | 'testimonial' | 'indication' | 'stage_change' | 'engagement'
  title: string
  description?: string
  date: string
}

function TabHistorico({ menteeId }: { menteeId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchAll() {
      const allEvents: TimelineEvent[] = []

      // Calls
      const { data: calls } = await supabase
        .from('call_records')
        .select('id, created_at, duration_seconds, recording_status')
        .eq('mentee_id', menteeId)
      calls?.forEach((c) => {
        const dur = c.duration_seconds ? `${Math.round(Number(c.duration_seconds) / 60)}min` : ''
        allEvents.push({
          id: `call-${c.id}`,
          type: 'call',
          title: `Ligação realizada${dur ? ` (${dur})` : ''}`,
          description: c.recording_status === 'ready' ? 'Gravação disponível' : undefined,
          date: c.created_at,
        })
      })

      // Revenue
      const { data: revenues } = await supabase
        .from('revenue_records')
        .select('id, product_name, sale_value, revenue_type, created_at')
        .eq('mentee_id', menteeId)
      revenues?.forEach((r) => {
        allEvents.push({
          id: `rev-${r.id}`,
          type: 'revenue',
          title: `Receita: R$ ${Number(r.sale_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          description: `${r.product_name} (${r.revenue_type})`,
          date: r.created_at,
        })
      })

      // Testimonials
      const { data: testimonials } = await supabase
        .from('testimonials')
        .select('id, description, testimonial_date, created_at')
        .eq('mentee_id', menteeId)
      testimonials?.forEach((t) => {
        allEvents.push({
          id: `test-${t.id}`,
          type: 'testimonial',
          title: 'Depoimento coletado',
          description: t.description && t.description.length > 80 ? t.description.slice(0, 80) + '...' : (t.description || ''),
          date: t.created_at,
        })
      })

      // Indications
      const { data: indications } = await supabase
        .from('indications')
        .select('id, indicated_name, created_at')
        .eq('mentee_id', menteeId)
      indications?.forEach((i) => {
        allEvents.push({
          id: `ind-${i.id}`,
          type: 'indication',
          title: `Indicação: ${i.indicated_name}`,
          date: i.created_at,
        })
      })

      // Engagement
      const { data: engagements } = await supabase
        .from('engagement_records')
        .select('id, type, value, recorded_at')
        .eq('mentee_id', menteeId)
      const engLabels: Record<string, string> = { aula: 'Área de Membros', live: 'Mentoria ao Vivo', evento: 'Evento', whatsapp_contato: 'Canal do Especialista' }
      engagements?.forEach((e) => {
        allEvents.push({
          id: `eng-${e.id}`,
          type: 'engagement',
          title: `${engLabels[e.type] || e.type}: ${Number(e.value)}`,
          date: e.recorded_at,
        })
      })

      // Stage changes
      const { data: stageChanges } = await supabase
        .from('stage_changes' as never)
        .select('id, from_stage_id, to_stage_id, changed_at' as never)
        .eq('mentee_id' as never, menteeId as never)
        .order('changed_at' as never, { ascending: true } as never) as { data: { id: string; from_stage_id: string | null; to_stage_id: string; changed_at: string }[] | null }

      // Fetch stage names
      const { data: allStages } = await supabase
        .from('kanban_stages')
        .select('id, name')
      const stageNameMap = new Map<string, string>()
      allStages?.forEach((s) => stageNameMap.set(s.id, s.name))

      if (stageChanges && stageChanges.length > 0) {
        for (let i = 0; i < stageChanges.length; i++) {
          const sc = stageChanges[i]
          const fromName = sc.from_stage_id ? stageNameMap.get(sc.from_stage_id) : null
          const toName = stageNameMap.get(sc.to_stage_id) || 'Desconhecida'

          // Calculate time spent in previous stage
          let timeSpent = ''
          if (i > 0) {
            const prevDate = new Date(stageChanges[i - 1].changed_at)
            const currDate = new Date(sc.changed_at)
            const diffMs = currDate.getTime() - prevDate.getTime()
            const diffDays = Math.floor(diffMs / 86400000)
            const diffHours = Math.floor((diffMs % 86400000) / 3600000)
            timeSpent = diffDays > 0 ? `${diffDays}d ${diffHours}h na etapa` : `${diffHours}h na etapa`
          }

          allEvents.push({
            id: `stage-${sc.id}`,
            type: 'stage_change',
            title: fromName
              ? `${fromName} → ${toName}`
              : `Entrou em ${toName}`,
            description: timeSpent || undefined,
            date: sc.changed_at,
          })
        }
      }

      // Sort by date descending
      allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setEvents(allEvents)
      setLoading(false)
    }
    fetchAll()
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const typeStyles: Record<string, { icon: string; color: string; bg: string }> = {
    call: { icon: '📞', color: 'text-info', bg: 'bg-info/10' },
    revenue: { icon: '💰', color: 'text-success', bg: 'bg-success/10' },
    testimonial: { icon: '💬', color: 'text-accent', bg: 'bg-accent/10' },
    indication: { icon: '👥', color: 'text-warning', bg: 'bg-warning/10' },
    stage_change: { icon: '📋', color: 'text-info', bg: 'bg-info/10' },
    engagement: { icon: '📊', color: 'text-muted-foreground', bg: 'bg-muted' },
    message: { icon: '💬', color: 'text-foreground', bg: 'bg-muted' },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-sm">Nenhum evento registrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-1 animate-fade-in">
      <p className="label-xs mb-3">Histórico ({events.length} eventos)</p>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        {events.map((event, idx) => {
          const style = typeStyles[event.type] || typeStyles.message
          const prevEvent = events[idx - 1]
          const showDate = !prevEvent || formatDateBR(event.date) !== formatDateBR(prevEvent.date)

          return (
            <div key={event.id}>
              {showDate && (
                <div className="relative pl-10 py-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">{formatDateBR(event.date)}</p>
                </div>
              )}
              <div className="relative flex items-start gap-3 pl-2 py-1.5">
                <div className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full ${style.bg} text-xs shrink-0 mt-0.5`}>
                  {style.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{event.title}</p>
                  {event.description && (
                    <p className="text-[11px] text-muted-foreground truncate">{event.description}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/50 tabular shrink-0">
                  {new Date(event.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab 7: Depoimentos ───
const TESTIMONIAL_CATEGORIES: { value: TestimonialCategory; label: string }[] = [
  { value: 'aumento_faturamento', label: 'Aumento de Faturamento' },
  { value: 'vida_pessoal', label: 'Vida Pessoal' },
  { value: 'vida_espiritual', label: 'Vida Espiritual' },
  { value: 'contratacao', label: 'Contratação' },
  { value: 'expansao_negocio', label: 'Expansão de Negócio' },
  { value: 'atendimento', label: 'Atendimento' },
  { value: 'intensivo', label: 'Intensivo' },
  { value: 'encontro_elite_premium', label: 'Encontro Elite Premium' },
]

function TabTestimonials({ menteeId }: { menteeId: string }) {
  const [items, setItems] = useState<Testimonial[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testimonialDate, setTestimonialDate] = useState('')
  const [description, setDescription] = useState('')
  const [niche, setNiche] = useState('')
  const [revenueRange, setRevenueRange] = useState('')
  const [employeeCount, setEmployeeCount] = useState('')
  const [categories, setCategories] = useState<TestimonialCategory[]>([])
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase
      .from('testimonials')
      .select('*')
      .eq('mentee_id', menteeId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setItems(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  function toggleCategory(cat: TestimonialCategory) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  function resetForm() {
    setTestimonialDate(''); setDescription(''); setNiche(''); setRevenueRange('')
    setEmployeeCount(''); setCategories([]); setEditingId(null); setAttachmentFile(null)
  }

  function handleEdit(item: Testimonial) {
    setEditingId(item.id)
    setTestimonialDate(item.testimonial_date)
    setDescription(item.description)
    setNiche(item.niche ?? '')
    setRevenueRange(item.revenue_range ?? '')
    setEmployeeCount(item.employee_count ?? '')
    setCategories((item.categories as TestimonialCategory[]) ?? [])
    setShowForm(true)
  }

  function handleCancelForm() {
    resetForm()
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(null)
    setItems((prev) => prev.filter((i) => i.id !== id))

    const undoTimeout = setTimeout(async () => {
      await deleteTestimonial(id)
      fetchData()
    }, 5000)

    toast('Depoimento excluído', {
      action: {
        label: 'Desfazer',
        onClick: () => {
          clearTimeout(undoTimeout)
          fetchData()
        },
      },
      duration: 5000,
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // Upload file if selected
    let attachmentUrl: string | undefined
    let attachmentType: 'photo' | 'video' | undefined

    if (attachmentFile) {
      setUploading(true)
      const fileExt = attachmentFile.name.split('.').pop()?.toLowerCase() ?? ''
      const isVideo = ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(fileExt)
      attachmentType = isVideo ? 'video' : 'photo'
      const filePath = `${menteeId}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('testimonials')
        .upload(filePath, attachmentFile)

      if (uploadError) {
        toast.error(`Erro no upload: ${uploadError.message}`)
        setLoading(false)
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('testimonials')
        .getPublicUrl(filePath)

      attachmentUrl = urlData.publicUrl
      setUploading(false)
    }

    if (editingId) {
      await updateTestimonial(editingId, {
        testimonial_date: testimonialDate,
        description,
        niche: niche || undefined,
        revenue_range: revenueRange || undefined,
        employee_count: employeeCount || undefined,
        categories,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
      })
    } else {
      await addTestimonial(menteeId, {
        testimonial_date: testimonialDate,
        description,
        niche: niche || undefined,
        revenue_range: revenueRange || undefined,
        employee_count: employeeCount || undefined,
        categories,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
      })
    }

    resetForm()
    setShowForm(false); setLoading(false)
    fetchData()
  }

  return (
    <div className="p-4 space-y-4">
      {/* Card header */}
      <div className="flex items-center gap-2 -mx-4 -mt-4 px-4 py-3 border-b border-border bg-muted/30">
        <Mic className="h-4 w-4 text-info" />
        <h3 className="font-heading font-semibold text-sm">Depoimentos</h3>
        <Badge variant="muted" className="text-[10px] ml-auto">{items.length}</Badge>
      </div>
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(!showForm) }}>
          <Plus className="mr-1 h-3 w-3" /> Registrar
        </Button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-1">
            <Label htmlFor="test-date">Data *</Label>
            <Input id="test-date" type="date" value={testimonialDate} onChange={(e) => setTestimonialDate(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="test-desc">Descrição *</Label>
            <Textarea id="test-desc" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="test-niche">Nicho</Label>
              <Input id="test-niche" value={niche} onChange={(e) => setNiche(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="test-revenue">Faixa de faturamento</Label>
              <Input id="test-revenue" value={revenueRange} onChange={(e) => setRevenueRange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="test-employees">Nº colaboradores</Label>
              <Input id="test-employees" value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="label-xs">Categorias</p>
            <div className="flex flex-wrap gap-2">
              {TESTIMONIAL_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => toggleCategory(cat.value)}
                  className={`rounded-sm px-2 py-1 text-xs font-medium transition-colors ${
                    categories.includes(cat.value)
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="label-xs">Anexo (foto ou vídeo)</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {attachmentFile ? attachmentFile.name : 'Selecionar arquivo'}
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {attachmentFile && (
                <button type="button" onClick={() => setAttachmentFile(null)} className="text-xs text-destructive hover:underline">
                  Remover
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={loading || uploading}>
              {uploading ? 'Enviando arquivo...' : loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
            </Button>
            {editingId && (
              <Button type="button" size="sm" variant="ghost" onClick={handleCancelForm}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      )}
      {items.map((item) => (
        <div key={item.id} className="relative rounded-lg border border-border bg-card p-3 text-sm group">
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => handleEdit(item)}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(item.id)}
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {confirmDeleteId === item.id && (
            <div className="mb-2 rounded-md bg-destructive/10 border border-destructive/20 p-2 flex items-center justify-between">
              <p className="text-xs text-destructive">Tem certeza que deseja excluir este depoimento?</p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={() => handleDelete(item.id)} disabled={loading}>
                  Excluir
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setConfirmDeleteId(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pr-16">
            <p className="text-xs text-muted-foreground">{formatDateBR(item.testimonial_date)}</p>
            {item.niche && <Badge variant="outline" className="text-[10px]">{item.niche}</Badge>}
          </div>
          <p className="mt-1 text-foreground">{item.description}</p>
          {item.attachment_url && (
            <div className="mt-2">
              {item.attachment_type === 'video' ? (
                <video
                  src={item.attachment_url}
                  controls
                  className="rounded-md max-h-48 w-full object-contain bg-black"
                />
              ) : (
                <Image
                  src={item.attachment_url}
                  alt="Depoimento"
                  width={400}
                  height={192}
                  className="rounded-md max-h-48 w-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(item.attachment_url!, '_blank')}
                  unoptimized={!item.attachment_url.includes('supabase')}
                />
              )}
            </div>
          )}
          {item.categories && item.categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.categories.map((cat) => (
                <Badge key={cat} variant="info" className="text-[10px]">
                  {TESTIMONIAL_CATEGORIES.find((c) => c.value === cat)?.label ?? cat}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
