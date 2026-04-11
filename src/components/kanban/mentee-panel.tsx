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
  Building2,
  XCircle,
  CalendarCheck,
  ClipboardCheck,
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
} from '@/lib/actions/panel-actions'
import dynamic from 'next/dynamic'
import { ErrorBoundary } from '@/components/error-boundary'
import type { MenteeRow, MenteeWithStats } from '@/types/kanban'

const TabChat = dynamic(
  () => import('./tab-chat').then((mod) => ({ default: mod.TabChat })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> }
)
import type { Database, TestimonialCategory, RevenueType, KanbanType } from '@/types/database'

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
  const priorityLabel = `Prioridade ${mentee.priority_level}`
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
  const [chatUnreads, setChatUnreads] = useState<Record<string, number>>({ principal: 0, comercial: 0, marketing: 0, gestao: 0 })
  const [activeTab, setActiveTab] = useState('info')

  // Fetch unread counts per channel on mount
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('wpp_messages')
      .select('channel')
      .eq('mentee_id', mentee.id)
      .eq('direction', 'incoming')
      .eq('is_read', false)
      .then(({ data }) => {
        if (!data) return
        const counts: Record<string, number> = { principal: 0, comercial: 0, marketing: 0, gestao: 0 }
        data.forEach((m) => {
          const ch = (m as { channel: string }).channel || 'principal'
          counts[ch] = (counts[ch] ?? 0) + 1
        })
        setChatUnreads(counts)
      })
  }, [mentee.id])

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
              { value: 'intensivo', label: 'Eventos' },
              { value: 'chat-principal', label: 'Chat Principal', channel: 'principal' },
              { value: 'chat-comercial', label: 'Comercial', channel: 'comercial' },
              { value: 'chat-marketing', label: 'Marketing', channel: 'marketing' },
              { value: 'chat-gestao', label: 'Gestão', channel: 'gestao' },
            ].map((tab) => {
              const unread = tab.channel ? chatUnreads[tab.channel] ?? 0 : 0
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="whitespace-nowrap rounded-none border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-accent data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <span className="flex items-center gap-1.5">
                    {tab.value === 'chat-principal' && <MessageSquare className="h-3.5 w-3.5" />}
                    {tab.label}
                    {unread > 0 && (
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                        {unread}
                      </span>
                    )}
                  </span>
                </TabsTrigger>
              )
            })}
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
      <ScrollArea className={`flex-1 px-4 py-4 sm:px-6 lg:px-8 ${activeTab.startsWith('chat-') ? 'hidden' : ''}`}>
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
        <TabsContent value="acompanhamento"><ErrorBoundary><TabAcompanhamento menteeId={mentee.id} mentee={mentee} onStatsChange={(stats) => {
          onMenteeUpdated?.({ ...mentee, indication_count: stats.indications, revenue_total: stats.revenue })
        }} /></ErrorBoundary></TabsContent>
        <TabsContent value="engajamento"><ErrorBoundary><TabEngajamento menteeId={mentee.id} mentee={mentee} /></ErrorBoundary></TabsContent>
        <TabsContent value="historico"><ErrorBoundary><TabHistorico menteeId={mentee.id} /></ErrorBoundary></TabsContent>
        <TabsContent value="intensivo"><ErrorBoundary><TabIntensivo menteeId={mentee.id} /></ErrorBoundary></TabsContent>
      </ScrollArea>
      {/* Chat tabs — outside ScrollArea (each manages its own scroll) */}
      {[
        { value: 'chat-principal', channel: 'principal', signature: 'Canal do especialista' },
        { value: 'chat-comercial', channel: 'comercial', signature: 'Hannah' },
        { value: 'chat-marketing', channel: 'marketing', signature: 'Matheus' },
        { value: 'chat-gestao', channel: 'gestao', signature: 'Keyth' },
      ].map((chat) => (
        <TabsContent key={chat.value} value={chat.value} className={`flex-1 overflow-hidden ${activeTab !== chat.value ? 'hidden' : ''}`}>
          <ErrorBoundary><TabChat
            menteeId={mentee.id}
            menteePhone={mentee.phone}
            menteeName={mentee.full_name}
            specialistId={mentee.created_by}
            onUnreadCountChange={(count: number) => setChatUnreads((prev) => ({ ...prev, [chat.channel]: count === -1 ? (prev[chat.channel] ?? 0) + 1 : count }))}
            onSessionChange={(active) => onMenteeUpdated?.({ ...mentee, has_active_session: active })}
            channel={chat.channel}
            signatureName={chat.signature}
          /></ErrorBoundary>
        </TabsContent>
      ))}
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

// ─── Stage Mover — compact inline selector for status bar ───
function StageMoverInline({ menteeId, currentStageId, kanbanType, onMoved }: {
  menteeId: string
  currentStageId: string | null
  kanbanType: KanbanType
  onMoved?: (newStageId: string, stageName: string) => void
}) {
  const [initialStages, setInitialStages] = useState<{ id: string; name: string }[]>([])
  const [mentorshipStages, setMentorshipStages] = useState<{ id: string; name: string }[]>([])
  const [exitStages, setExitStages] = useState<{ id: string; name: string }[]>([])
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('kanban_stages')
      .select('id, name, type')
      .order('position')
      .then(({ data }) => {
        if (data) {
          setInitialStages(data.filter((s) => s.type === 'initial'))
          setMentorshipStages(data.filter((s) => s.type === 'mentorship'))
          setExitStages(data.filter((s) => s.type === 'exit'))
        }
      })
  }, [])

  const allStages = [...initialStages, ...mentorshipStages, ...exitStages]

  async function handleMove(newStageId: string) {
    if (newStageId === currentStageId || moving) return
    setMoving(true)

    // Determine if switching kanban type
    const isInitialStage = initialStages.some((s) => s.id === newStageId)
    const isExitStage = exitStages.some((s) => s.id === newStageId)
    const newKanbanType: KanbanType = isInitialStage ? 'initial' : isExitStage ? 'exit' : 'mentorship'
    const switchingType = newKanbanType !== kanbanType

    // Update stage (and kanban_type if switching between funnels)
    const supabase = createClient()
    const updates: Record<string, unknown> = {
      current_stage_id: newStageId,
      updated_at: new Date().toISOString(),
    }
    if (switchingType) {
      updates.kanban_type = newKanbanType
    }

    const { error } = await supabase.from('mentees').update(updates).eq('id', menteeId)

    // Also log stage change
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('stage_changes' as never).insert({
        mentee_id: menteeId,
        from_stage_id: currentStageId,
        to_stage_id: newStageId,
        changed_by: user.id,
      } as never)
    }

    setMoving(false)
    if (error) {
      toast.error(error.message)
    } else {
      const stageName = allStages.find((s) => s.id === newStageId)?.name || ''
      const typeLabel = switchingType ? (newKanbanType === 'mentorship' ? ' (Mentoria)' : ' (Iniciais)') : ''
      toast.success(`Movido para "${stageName}"${typeLabel}`)
      onMoved?.(newStageId, stageName)
    }
  }

  if (allStages.length === 0) return null

  return (
    <Select value={currentStageId || ''} onValueChange={handleMove} disabled={moving}>
      <SelectTrigger className="h-7 w-auto min-w-[140px] max-w-[220px] text-[11px] rounded-full border-accent/30 bg-accent/5 text-accent gap-1 px-2.5">
        <ChevronRight className="h-3 w-3 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {initialStages.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Etapas Iniciais</div>
            {initialStages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} {s.id === currentStageId ? '(atual)' : ''}
              </SelectItem>
            ))}
          </>
        )}
        {mentorshipStages.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border mt-1 pt-1.5">Etapas Mentoria</div>
            {mentorshipStages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} {s.id === currentStageId ? '(atual)' : ''}
              </SelectItem>
            ))}
          </>
        )}
        {exitStages.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border mt-1 pt-1.5">Gestão de Saídas</div>
            {exitStages.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} {s.id === currentStageId ? '(atual)' : ''}
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
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
  const [saving] = useState(false)
  const [cancelling] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Fetch action plan data for Empresa block
  const [empresaData, setEmpresaData] = useState<{
    nome_empresa?: string
    num_colaboradores?: string
    nicho?: string
    faturamento_medio?: number
    motivacao_elite_premium?: string
    expectativas_resultados?: string
  }>({})
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('action_plans')
      .select('data')
      .eq('mentee_id', mentee.id)
      .not('data', 'is', null)
      .maybeSingle()
      .then(({ data: ap }) => {
        if (ap?.data) {
          const d = ap.data as Record<string, unknown>
          setEmpresaData({
            nome_empresa: d.nome_empresa ? String(d.nome_empresa) : undefined,
            num_colaboradores: d.num_colaboradores ? String(d.num_colaboradores) : undefined,
            nicho: d.nicho ? String(d.nicho) : undefined,
            faturamento_medio: d.faturamento_medio ? Number(d.faturamento_medio) : undefined,
            motivacao_elite_premium: d.motivacao_elite_premium ? String(d.motivacao_elite_premium) : undefined,
            expectativas_resultados: d.expectativas_resultados ? String(d.expectativas_resultados) : undefined,
          })
        }
      })
  }, [mentee.id])

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
    // Optimistic: close form and update parent immediately
    const updatedMentee = { ...mentee, ...form, email: form.email || null, instagram: form.instagram || null, city: form.city || null, state: form.state || null, birth_date: form.birth_date || null, end_date: form.end_date || null, cpf: form.cpf || null, partner_name: form.partner_name || null, seller_name: form.seller_name || null, funnel_origin: form.funnel_origin || null }
    setEditing(false)
    onMenteeUpdated?.(updatedMentee)
    toast.success('Salvo')

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
    if (result.error) {
      // Revert on error: reopen form and restore original mentee data
      toast.error(result.error)
      setEditing(true)
      onMenteeUpdated?.(mentee)
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
        <StageMoverInline
          menteeId={mentee.id}
          currentStageId={mentee.current_stage_id}
          kanbanType={mentee.kanban_type}
          onMoved={(newStageId) => {
            if (onMenteeUpdated) {
              onMenteeUpdated({ ...mentee, current_stage_id: newStageId })
            }
          }}
        />
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

          {/* Empresa — nome, nicho, colaboradores, faturamento, motivação, expectativas */}
          {(empresaData.nome_empresa || mentee.niche || empresaData.nicho || empresaData.num_colaboradores || mentee.has_partner || mentee.faturamento_atual != null || mentee.faturamento_antes_mentoria != null || empresaData.faturamento_medio || empresaData.motivacao_elite_premium || empresaData.expectativas_resultados) && (
            <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-success/5 to-transparent">
                <Building2 className="h-3.5 w-3.5 text-success" />
                <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Empresa</h3>
              </div>
              <div className="px-3 py-2 space-y-0">
                {empresaData.nome_empresa && <ContactRow icon={Building2} label="Nome" value={empresaData.nome_empresa} color="text-success" bg="bg-success/10" />}
                {(mentee.niche || empresaData.nicho) && <ContactRow icon={Target} label="Nicho" value={(mentee.niche || empresaData.nicho)!} color="text-accent" bg="bg-accent/10" />}
                {empresaData.num_colaboradores && <ContactRow icon={Users} label="Colaboradores" value={empresaData.num_colaboradores} color="text-info" bg="bg-info/10" />}
                <ContactRow icon={Users} label="Sócio" value={mentee.has_partner ? (mentee.partner_name || 'Sim') : 'Não'} color={mentee.has_partner ? 'text-accent' : 'text-muted-foreground'} bg={mentee.has_partner ? 'bg-accent/10' : 'bg-muted'} />
                {mentee.faturamento_atual != null && <ContactRow icon={DollarSign} label="Faturamento atual" value={formatBRL(mentee.faturamento_atual)} color="text-success" bg="bg-success/10" />}
                {mentee.faturamento_antes_mentoria != null && <ContactRow icon={DollarSign} label="Fat. antes da mentoria" value={formatBRL(mentee.faturamento_antes_mentoria)} color="text-warning" bg="bg-warning/10" />}
                {empresaData.faturamento_medio != null && empresaData.faturamento_medio > 0 && <ContactRow icon={DollarSign} label="Fat. médio (formulário)" value={formatBRL(empresaData.faturamento_medio / 100)} color="text-info" bg="bg-info/10" />}
              </div>
              {(empresaData.motivacao_elite_premium || empresaData.expectativas_resultados) && (
                <div className="px-3 pb-2 space-y-2 border-t border-border/50 pt-2">
                  {empresaData.motivacao_elite_premium && (
                    <div>
                      <p className="text-[9px] text-muted-foreground/70 leading-none mb-0.5">Por que decidiu fazer parte da Elite Premium?</p>
                      <p className="text-[12px] text-foreground leading-snug whitespace-pre-line">{empresaData.motivacao_elite_premium}</p>
                    </div>
                  )}
                  {empresaData.expectativas_resultados && (
                    <div>
                      <p className="text-[9px] text-muted-foreground/70 leading-none mb-0.5">O que espera de resultados ao final da mentoria?</p>
                      <p className="text-[12px] text-foreground leading-snug whitespace-pre-line">{empresaData.expectativas_resultados}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
              {mentee.start_date && <ContactRow icon={Calendar} label="Início" value={formatDateBR(mentee.start_date)} color="text-success" bg="bg-success/10" />}
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

      {/* ── Solicitar Cancelamento ── */}
      {mentee.status !== 'cancelado' && (
        <div className="flex justify-start pt-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setCancelOpen(true)}
            className="text-xs gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5" />
            Solicitar Cancelamento
          </Button>
        </div>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitação de Cancelamento</DialogTitle>
            <DialogDescription>
              Registre o motivo da solicitação de cancelamento de {mentee.full_name}. O mentorado será movido para a Gestão de Saídas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            if (cancelReason.trim().length < 10) {
              toast.error('Descreva o motivo com mais detalhes (mínimo 10 caracteres)')
              return
            }
            const supabase = createClient()
            const timestamp = new Date().toLocaleDateString('pt-BR')
            const cancelNote = `[SOLICITAÇÃO DE CANCELAMENTO ${timestamp}] ${cancelReason.trim()}`
            const existingNotes = mentee.notes?.trim() || ''
            const newNotes = existingNotes ? `${cancelNote}\n\n${existingNotes}` : cancelNote

            // Find the first exit stage ("Em Processo de Cancelamento")
            const { data: exitStage } = await supabase
              .from('kanban_stages')
              .select('id')
              .eq('type', 'exit')
              .order('position')
              .limit(1)
              .single()

            if (!exitStage) {
              toast.error('Etapa de saída não encontrada')
              return
            }

            // Update mentee: notes + move to exit kanban
            const { error } = await supabase
              .from('mentees')
              .update({
                notes: newNotes,
                current_stage_id: exitStage.id,
                kanban_type: 'exit' as KanbanType,
                updated_at: new Date().toISOString(),
              })
              .eq('id', mentee.id)

            if (error) {
              toast.error(error.message)
              return
            }

            // Log stage change
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              await supabase.from('stage_changes' as never).insert({
                mentee_id: mentee.id,
                from_stage_id: mentee.current_stage_id,
                to_stage_id: exitStage.id,
                changed_by: user.id,
              } as never)
            }

            toast.success('Solicitação registrada — mentorado movido para Gestão de Saídas')
            setCancelOpen(false)
            setCancelReason('')
            onMenteeUpdated?.({ ...mentee, notes: newNotes, current_stage_id: exitStage.id, kanban_type: 'exit' as KanbanType })
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancel-reason">Motivo da solicitação *</Label>
              <Textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                required
                minLength={10}
                className="min-h-[120px] resize-y"
                placeholder="Descreva detalhadamente o motivo da solicitação de cancelamento..."
              />
              <p className="text-[10px] text-muted-foreground">Mínimo 10 caracteres. Será registrado nas observações do mentorado.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { setCancelOpen(false); setCancelReason('') }}>
                Voltar
              </Button>
              <Button type="submit" variant="destructive" size="sm" disabled={cancelling || cancelReason.trim().length < 10}>
                {cancelling ? 'Registrando...' : 'Registrar Solicitação'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}

// ─── Personal Tags Card ───
function PersonalTagsCard({ menteeId, initialTags }: { menteeId: string; initialTags: string[] }) {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function saveTags(newTags: string[], prevTags: string[]) {
    setSaving(true)
    const { error } = await supabase.from('mentees').update({ personal_tags: newTags }).eq('id', menteeId)
    setSaving(false)
    if (error) {
      // Revert on error
      setTags(prevTags)
      toast.error('Erro ao salvar tag')
    }
  }

  function handleAdd() {
    const tag = input.trim()
    if (!tag || tags.includes(tag)) return
    const prevTags = tags
    const newTags = [...tags, tag]
    // Optimistic: update UI immediately
    setTags(newTags)
    setInput('')
    saveTags(newTags, prevTags)
  }

  function handleRemove(tag: string) {
    const prevTags = tags
    const newTags = tags.filter((t) => t !== tag)
    // Optimistic: update UI immediately
    setTags(newTags)
    saveTags(newTags, prevTags)
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

// ─── Notes Card (tag-based, same layout as PersonalTagsCard) ───
interface NoteItem { text: string; date: string }

function NotesCard({ menteeId, initialNotes }: { menteeId: string; initialNotes: string }) {
  // Parse notes: support both legacy plain text and new JSON format
  const parseNotes = (raw: string): NoteItem[] => {
    if (!raw.trim()) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'text' in parsed[0]) {
        return parsed
      }
    } catch { /* not JSON, parse as legacy */ }
    return raw.split('\n').map((n) => n.trim()).filter(Boolean).map((text) => ({ text, date: '' }))
  }

  const [items, setItems] = useState<NoteItem[]>(parseNotes(initialNotes))
  const [input, setInput] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function saveNotes(newItems: NoteItem[], prevItems: NoteItem[]) {
    setSaving(true)
    const { error } = await supabase.from('mentees').update({ notes: JSON.stringify(newItems) }).eq('id', menteeId)
    setSaving(false)
    if (error) {
      setItems(prevItems)
      toast.error('Erro ao salvar observação')
    }
  }

  function handleAdd() {
    const note = input.trim()
    if (!note) return
    const prevItems = items
    const newItems = [...items, { text: note, date: new Date().toISOString() }]
    setItems(newItems)
    setInput('')
    saveNotes(newItems, prevItems)
  }

  function handleRemove(idx: number) {
    const prevItems = items
    const newItems = items.filter((_, i) => i !== idx)
    setItems(newItems)
    saveNotes(newItems, prevItems)
  }

  function handleEditSave(idx: number) {
    const text = editText.trim()
    if (!text) return
    const prevItems = items
    const newItems = items.map((item, i) => i === idx ? { ...item, text } : item)
    setItems(newItems)
    setEditingIdx(null)
    setEditText('')
    saveNotes(newItems, prevItems)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  function formatNoteDate(iso: string) {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
    } catch { return '' }
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
        <Pencil className="h-3.5 w-3.5 text-accent" />
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Observações</h3>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
      </div>
      <div className="p-3 space-y-2">
        {items.length === 0 && (
          <p className="text-[11px] text-muted-foreground/40 italic py-1">Adicione observações abaixo</p>
        )}
        {items.map((note, idx) => (
          <div key={idx} className="group rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5">
            {editingIdx === idx ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEditSave(idx) } if (e.key === 'Escape') setEditingIdx(null) }}
                  className="h-7 text-xs flex-1"
                  autoFocus
                />
                <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" onClick={() => handleEditSave(idx)}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={() => setEditingIdx(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] text-foreground leading-relaxed flex-1 whitespace-pre-wrap">{note.text}</p>
                <div className="flex items-center gap-1 shrink-0">
                  {note.date && (
                    <span className="text-[9px] text-muted-foreground/50 tabular">{formatNoteDate(note.date)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setEditingIdx(idx); setEditText(note.text) }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-accent transition-all"
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Gosta de viajar, Meta: 100k/mês..."
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

  async function handleToggle() {
    const prev = fit
    const newValue = !fit
    // Optimistic: update UI immediately
    setFit(newValue)
    try {
      await toggleClienteFit(menteeId, newValue)
    } catch {
      // Revert on error
      setFit(prev)
      toast.error('Erro ao salvar cliente fit')
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fit ? 'bg-warning' : 'bg-muted'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${fit ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}


// ─── Tab 2: Plano de Ação ───

const ACTION_PLAN_LABELS: Record<string, string> = {
  endereco_completo: 'Endereço completo',
  cpf: 'CPF',
  data_aniversario: 'Data de aniversário',
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
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [viewerFile, setViewerFile] = useState<{ name: string; url: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('action_plans')
      .select('*')
      .eq('mentee_id', mentee.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setPlan(data) })

    // Load all attachments
    supabase.storage
      .from('action-plans')
      .list(mentee.id)
      .then(({ data: files }) => {
        if (files && files.length > 0) {
          const all = files.map((f) => {
            const { data: urlData } = supabase.storage
              .from('action-plans')
              .getPublicUrl(`${mentee.id}/${f.name}`)
            return { name: f.name, url: urlData.publicUrl }
          })
          setAttachments(all)
        }
      })
  }, [mentee.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const safeName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-zA-Z0-9._-]/g, '-') // only safe chars
        .replace(/-+/g, '-') // collapse dashes
      const filePath = `${mentee.id}/${Date.now()}_${safeName}`

      const { error } = await supabase.storage
        .from('action-plans')
        .upload(filePath, file, { contentType: file.type })

      if (error) {
        toast.error('Erro ao enviar arquivo: ' + error.message)
        return
      }

      const { data: urlData } = supabase.storage
        .from('action-plans')
        .getPublicUrl(filePath)

      const newName = filePath.split('/').pop()!
      setAttachments((prev) => [...prev, { name: newName, url: urlData.publicUrl }])
      toast.success('Arquivo anexado com sucesso')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemoveAttachment(fileName: string) {
    const confirmed = window.confirm('Remover este arquivo?')
    if (!confirmed) return

    const { error } = await supabase.storage
      .from('action-plans')
      .remove([`${mentee.id}/${fileName}`])

    if (error) {
      toast.error('Erro ao remover: ' + error.message)
      return
    }

    setAttachments((prev) => prev.filter((a) => a.name !== fileName))
    if (viewerFile?.name === fileName) setViewerFile(null)
    toast.success('Arquivo removido')
  }

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
      {/* ── Planos de ação anexados ── */}
      <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
          <FileDown className="h-3.5 w-3.5 text-accent" />
          <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Planos de ação anexados</h3>
        </div>
        <div className="p-3 space-y-2">
          {attachments.length > 0 ? (
            attachments.map((att) => (
              <div key={att.name} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                <FileDown className="h-4 w-4 text-accent shrink-0" />
                <span className="text-sm text-foreground font-medium truncate flex-1">{att.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setViewerFile(att)} className="text-xs gap-1 h-7">
                    <FileDown className="h-3 w-3" /> Ver
                  </Button>
                  <a href={att.url} download={att.name} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="text-xs gap-1 h-7">
                      <FileDown className="h-3 w-3" /> Baixar
                    </Button>
                  </a>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveAttachment(att.name)} className="text-xs text-destructive h-7">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum arquivo anexado</p>
          )}
          <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            {uploading ? 'Enviando...' : 'Anexar arquivo'}
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={handleUploadAttachment} disabled={uploading} />
          </label>
        </div>
      </div>

      {/* ── Viewer dialog ── */}
      {viewerFile && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/80" onClick={() => setViewerFile(null)}>
          <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border shrink-0" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm font-medium text-foreground truncate">{viewerFile.name}</span>
            <div className="flex items-center gap-2">
              <a href={viewerFile.url} download={viewerFile.name} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="text-xs gap-1.5">
                  <FileDown className="h-3.5 w-3.5" /> Baixar
                </Button>
              </a>
              <Button size="sm" variant="ghost" onClick={() => setViewerFile(null)} className="text-xs">
                Fechar
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            {viewerFile.name.toLowerCase().endsWith('.pdf') ? (
              <iframe src={viewerFile.url} className="w-full h-full min-h-[80vh] rounded-lg bg-white" title="Plano de ação" />
            ) : /\.(jpg|jpeg|png|gif|webp)$/i.test(viewerFile.name) ? (
              <div className="flex items-center justify-center h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewerFile.url} alt="Plano de ação" className="max-w-full max-h-[85vh] rounded-lg shadow-lg" />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-white text-sm">Pré-visualização não disponível para este tipo de arquivo. Use o botão &quot;Baixar&quot;.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Respostas do formulário ── */}
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
// ─── Card: Tarefas do Mentorado ───
function CardMenteeTasks({ menteeId }: { menteeId: string }) {
  const [tasks, setTasks] = useState<Database['public']['Tables']['tasks']['Row'][]>([])
  const [columns, setColumns] = useState<Database['public']['Tables']['task_columns']['Row'][]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase.from('tasks').select('*').eq('mentee_id', menteeId).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setTasks(data) })
    supabase.from('task_columns').select('*').order('position')
      .then(({ data }) => { if (data) setColumns(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const getColName = (colId: string | null) => columns.find((c) => c.id === colId)?.name ?? '—'
  const isOverdue = (t: typeof tasks[0]) => t.due_date && !t.completed_at && new Date(t.due_date) < new Date(new Date().toISOString().split('T')[0])

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 -mx-4 -mt-4 px-4 py-3 border-b border-border bg-muted/30">
        <ClipboardCheck className="h-4 w-4 text-accent" />
        <h3 className="font-heading font-semibold text-sm">Tarefas</h3>
        <Badge variant="muted" className="text-[10px] ml-auto">{tasks.length}</Badge>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa vinculada</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className={`rounded-lg border p-3 text-sm ${isOverdue(task) ? 'border-destructive/30 bg-destructive/5' : task.completed_at ? 'border-success/30 bg-success/5' : 'border-border bg-card'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-medium leading-tight ${task.completed_at ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                  {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>}
                </div>
                <Badge variant={isOverdue(task) ? 'destructive' : task.completed_at ? 'success' : 'muted'} className="text-[10px] shrink-0">
                  {isOverdue(task) ? 'Atrasada' : task.completed_at ? 'Concluída' : getColName(task.column_id)}
                </Badge>
              </div>
              {task.due_date && (
                <p className={`text-[10px] mt-1 ${isOverdue(task) ? 'text-destructive' : 'text-muted-foreground'}`}>
                  Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Card: Entregas Mentoria ───
const DELIVERY_TYPES = [
  { key: 'hotseat', label: 'Hotseat' },
  { key: 'comercial', label: 'Comercial' },
  { key: 'gestao', label: 'Gestão' },
  { key: 'mkt', label: 'Mkt' },
  { key: 'extras', label: 'Entregas Extras' },
  { key: 'mentoria_individual', label: 'Mentoria Individual' },
]

function CardEntregasMentoria({ menteeId, startDate }: { menteeId: string; startDate: string | null }) {
  const [deliveryStats, setDeliveryStats] = useState<Record<string, { delivered: number; participated: number }>>({})
  const supabase = createClient()

  useEffect(() => {
    async function fetchDeliveries() {
      // Fetch all delivery events since mentee start date
      let eventsQuery = supabase.from('delivery_events').select('id, delivery_type, delivery_date')
      if (startDate) {
        eventsQuery = eventsQuery.gte('delivery_date', startDate)
      }
      const { data: events } = await eventsQuery

      // Fetch participations for this mentee
      const { data: participations } = await supabase
        .from('delivery_participations')
        .select('delivery_event_id')
        .eq('mentee_id', menteeId)

      const participatedSet = new Set(participations?.map((p) => p.delivery_event_id) ?? [])

      // Calculate stats per type
      const stats: Record<string, { delivered: number; participated: number }> = {}
      for (const dt of DELIVERY_TYPES) {
        stats[dt.key] = { delivered: 0, participated: 0 }
      }

      events?.forEach((ev) => {
        const type = ev.delivery_type
        if (!stats[type]) stats[type] = { delivered: 0, participated: 0 }
        stats[type].delivered++
        if (participatedSet.has(ev.id)) {
          stats[type].participated++
        }
      })

      setDeliveryStats(stats)
    }
    fetchDeliveries()
  }, [menteeId, startDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalDelivered = Object.values(deliveryStats).reduce((s, d) => s + d.delivered, 0)
  const totalParticipated = Object.values(deliveryStats).reduce((s, d) => s + d.participated, 0)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 -mx-4 -mt-4 px-4 py-3 border-b border-border bg-muted/30">
        <CalendarCheck className="h-4 w-4 text-accent" />
        <h3 className="font-heading font-semibold text-sm">Entregas Mentoria</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {totalParticipated}/{totalDelivered} participações
        </span>
      </div>

      <div className="space-y-2">
        {DELIVERY_TYPES.map((dt) => {
          const stat = deliveryStats[dt.key] ?? { delivered: 0, participated: 0 }
          const pct = stat.delivered > 0 ? Math.round((stat.participated / stat.delivered) * 100) : 0
          return (
            <div key={dt.key} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium text-foreground">{dt.label}</p>
                <span className="text-[10px] text-muted-foreground">{pct}%</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Entregues: </span>
                  <span className="font-semibold tabular">{stat.delivered}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Participou: </span>
                  <span className="font-semibold tabular text-success">{stat.participated}</span>
                </div>
              </div>
              {stat.delivered > 0 && (
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabAcompanhamento({ menteeId, mentee, onStatsChange }: { menteeId: string; mentee: MenteeWithStats; onStatsChange?: (stats: { indications: number; revenue: number }) => void }) {
  const [stats, setStats] = useState({ indications: 0, converted: 0, convertedValue: 0, revenue: 0, testimonials: 0, sessions: 0, extras: 0 })
  const supabase = createClient()
  const onStatsChangeRef = useRef(onStatsChange)
  onStatsChangeRef.current = onStatsChange

  const fetchStats = useCallback(async () => {
    const [{ data: ind }, { data: rev }, { data: test }, { data: sess }, { data: ext }] = await Promise.all([
      supabase.from('indications').select('id, converted, converted_value').eq('mentee_id', menteeId),
      supabase.from('revenue_records').select('sale_value').eq('mentee_id', menteeId),
      supabase.from('testimonials').select('id').eq('mentee_id', menteeId),
      supabase.from('individual_sessions').select('id').eq('mentee_id', menteeId),
      supabase.from('extra_deliveries').select('id').eq('mentee_id', menteeId),
    ])
    const newStats = {
      indications: ind?.length ?? 0,
      converted: ind?.filter((i) => i.converted).length ?? 0,
      convertedValue: ind?.filter((i) => i.converted).reduce((s, i) => s + Number(i.converted_value ?? 0), 0) ?? 0,
      revenue: rev?.reduce((s, r) => s + Number(r.sale_value), 0) ?? 0,
      testimonials: test?.length ?? 0,
      sessions: sess?.length ?? 0,
      extras: ext?.length ?? 0,
    }
    setStats(newStats)
    onStatsChangeRef.current?.({ indications: newStats.indications, revenue: newStats.revenue })
  }, [menteeId, supabase])

  useEffect(() => { fetchStats() }, [fetchStats])

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
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden lg:col-span-2">
          <CardMenteeTasks menteeId={menteeId} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden lg:col-span-2">
          <CardEntregasMentoria menteeId={menteeId} startDate={mentee.start_date} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <CardIndicacoes menteeId={menteeId} onChanged={fetchStats} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <TabRevenue menteeId={menteeId} onChanged={fetchStats} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <CardIndividualSessions menteeId={menteeId} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <CardExtraDeliveries menteeId={menteeId} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <TabTestimonials menteeId={menteeId} mentee={mentee} />
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
  const [specialist, setSpecialist] = useState('')
  const [notes, setNotes] = useState('')
  const [loading] = useState(false)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase.from('individual_sessions').select('*').eq('mentee_id', menteeId)
      .order('session_date', { ascending: false }).then(({ data }) => { if (data) setItems(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [fetchData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Optimistic: add placeholder item and close form immediately
    const optimisticItem = {
      id: `temp-${Date.now()}`,
      mentee_id: menteeId,
      session_date: sessionDate,
      duration_minutes: null,
      specialist_name: specialist || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
    } as Database['public']['Tables']['individual_sessions']['Row']
    setItems((prev) => [optimisticItem, ...prev])
    const savedDate = sessionDate; const savedSpecialist = specialist; const savedNotes = notes
    setSessionDate(''); setSpecialist(''); setNotes(''); setShowForm(false)

    try {
      await addIndividualSession(menteeId, { session_date: savedDate, specialist_name: savedSpecialist || undefined, notes: savedNotes || undefined })
      fetchData()
    } catch {
      // Revert on error
      setItems((prev) => prev.filter((i) => i.id !== optimisticItem.id))
      toast.error('Erro ao registrar sessão')
    }
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
  const [loading] = useState(false)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase.from('extra_deliveries').select('*').eq('mentee_id', menteeId)
      .order('delivery_date', { ascending: false }).then(({ data }) => { if (data) setItems(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData() }, [fetchData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Optimistic: add placeholder item and close form immediately
    const optimisticItem = {
      id: `temp-${Date.now()}`,
      mentee_id: menteeId,
      delivery_date: deliveryDate,
      delivery_type: deliveryType,
      description: description || null,
      created_at: new Date().toISOString(),
    } as Database['public']['Tables']['extra_deliveries']['Row']
    setItems((prev) => [optimisticItem, ...prev])
    const savedDate = deliveryDate; const savedType = deliveryType; const savedDesc = description
    setDeliveryDate(''); setDeliveryType('outro'); setDescription(''); setShowForm(false)

    try {
      await addExtraDelivery(menteeId, { delivery_date: savedDate, delivery_type: savedType, description: savedDesc || undefined })
      fetchData()
    } catch {
      // Revert on error
      setItems((prev) => prev.filter((i) => i.id !== optimisticItem.id))
      toast.error('Erro ao registrar entrega')
    }
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

// ─── Tab: LTV do Mentorado ───
function TabRevenue({ menteeId, onChanged }: { menteeId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<RevenueRecord[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [customProductName, setCustomProductName] = useState('')
  const [saleCents, setSaleCents] = useState(0)
  const [entryCents, setEntryCents] = useState(0)
  const [revenueType, setRevenueType] = useState<RevenueType>('crossell')
  const [loading] = useState(false)
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
      onChanged?.()
    }, 5000)

    toast('Registro excluído', {
      action: {
        label: 'Desfazer',
        onClick: () => {
          clearTimeout(undoTimeout)
          setDeletingId(null)
          fetchData()
          onChanged?.()
        },
      },
      duration: 5000,
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resolvedProductName) return

    const savedProductName = resolvedProductName
    const savedSaleCents = saleCents
    const savedEntryCents = entryCents
    const savedRevenueType = revenueType
    const savedEditingId = editingId
    const prevItems = [...items]

    if (savedEditingId) {
      // Optimistic: update item in list immediately
      setItems((prev) => prev.map((i) => i.id === savedEditingId ? { ...i, product_name: savedProductName, sale_value: centsToDecimal(savedSaleCents), entry_value: centsToDecimal(savedEntryCents), revenue_type: savedRevenueType } : i))
    } else {
      // Optimistic: add placeholder item immediately
      const optimisticItem = {
        id: `temp-${Date.now()}`,
        mentee_id: menteeId,
        product_name: savedProductName,
        sale_value: centsToDecimal(savedSaleCents),
        entry_value: centsToDecimal(savedEntryCents),
        revenue_type: savedRevenueType,
        created_at: new Date().toISOString(),
      } as RevenueRecord
      setItems((prev) => [optimisticItem, ...prev])
    }
    resetForm()

    try {
      if (savedEditingId) {
        await updateRevenueRecord(savedEditingId, {
          product_name: savedProductName,
          sale_value: centsToDecimal(savedSaleCents),
          entry_value: centsToDecimal(savedEntryCents),
          revenue_type: savedRevenueType,
        })
      } else {
        await addRevenueRecord(menteeId, {
          product_name: savedProductName,
          sale_value: centsToDecimal(savedSaleCents),
          entry_value: centsToDecimal(savedEntryCents),
          revenue_type: savedRevenueType,
        })
      }
      fetchData()
      onChanged?.()
    } catch {
      // Revert on error
      setItems(prevItems)
      toast.error('Erro ao salvar registro')
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Card header */}
      <div className="flex items-center gap-2 -mx-4 -mt-4 px-4 py-3 border-b border-border bg-muted/30">
        <DollarSign className="h-4 w-4 text-success" />
        <h3 className="font-heading font-semibold text-sm">LTV do Mentorado</h3>
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
function parseCurrencyInd(raw: string): number {
  return parseInt(raw.replace(/\D/g, '') || '0', 10)
}
function fmtCurrencyInd(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function CardIndicacoes({ menteeId, onChanged }: { menteeId: string; onChanged?: () => void }) {
  const [indications, setIndications] = useState<Indication[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [indDate, setIndDate] = useState('')
  const [qtyIndicated, setQtyIndicated] = useState('')
  const [qtyConfirmed, setQtyConfirmed] = useState('')
  const [revenueCents, setRevenueCents] = useState(0)
  const [entryCents, setEntryCents] = useState(0)
  const [indLoading] = useState(false)
  const [confirmDeleteInd, setConfirmDeleteInd] = useState<string | null>(null)

  const supabase = createClient()

  const fetchAll = useCallback(() => {
    supabase.from('indications').select('*').eq('mentee_id', menteeId)
      .order('created_at', { ascending: false }).then(({ data }) => { if (data) setIndications(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll() }, [fetchAll])

  function resetForm() {
    setEditingId(null); setIndDate(''); setQtyIndicated(''); setQtyConfirmed(''); setRevenueCents(0); setEntryCents(0)
  }

  function openEdit(ind: Indication) {
    setEditingId(ind.id)
    setIndDate(ind.indication_date ?? '')
    setQtyIndicated(String(ind.quantity_indicated ?? 0))
    setQtyConfirmed(String(ind.quantity_confirmed ?? 0))
    setRevenueCents(Math.round((ind.revenue_generated ?? 0) * 100))
    setEntryCents(Math.round(((ind as Record<string, unknown>).entry_value as number ?? 0) * 100))
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = {
      indication_date: indDate,
      quantity_indicated: parseInt(qtyIndicated || '0', 10),
      quantity_confirmed: parseInt(qtyConfirmed || '0', 10),
      revenue_generated: revenueCents / 100,
      entry_value: entryCents / 100,
    }
    const savedEditingId = editingId
    const prevIndications = [...indications]

    if (savedEditingId) {
      // Optimistic: update item in list immediately
      setIndications((prev) => prev.map((i) => i.id === savedEditingId ? { ...i, ...data } : i))
      resetForm(); setShowForm(false)
    } else {
      // Optimistic: add placeholder item immediately
      const optimisticItem = {
        id: `temp-${Date.now()}`,
        mentee_id: menteeId,
        indicated_name: '', indicated_phone: '', notes: null,
        converted: false, converted_name: null, converted_value: null, converted_at: null,
        ...data,
        created_at: new Date().toISOString(),
      } as Indication
      setIndications((prev) => [optimisticItem, ...prev])
      resetForm()
      // Keep showForm true for "+" series flow
    }

    try {
      if (savedEditingId) {
        await updateIndication(savedEditingId, data)
      } else {
        await addIndication(menteeId, data)
      }
      fetchAll()
      onChanged?.()
    } catch {
      // Revert on error
      setIndications(prevIndications)
      toast.error('Erro ao salvar indicação')
    }
  }

  async function handleDelete(id: string) {
    setConfirmDeleteInd(null)
    setIndications((prev) => prev.filter((i) => i.id !== id))
    const undoTimeout = setTimeout(async () => { await deleteIndication(id); fetchAll(); onChanged?.() }, 5000)
    toast('Indicação excluída', { action: { label: 'Desfazer', onClick: () => { clearTimeout(undoTimeout); fetchAll(); onChanged?.() } }, duration: 5000 })
  }

  const totalIndicated = indications.reduce((s, i) => s + (i.quantity_indicated ?? 0), 0)
  const totalConfirmed = indications.reduce((s, i) => s + (i.quantity_confirmed ?? 0), 0)
  const totalRevenue = indications.reduce((s, i) => s + Number(i.revenue_generated ?? 0), 0)

  return (
    <div className="p-4 space-y-4">
      {/* Card header */}
      <div className="flex items-center gap-2 -mx-4 -mt-4 px-4 py-3 border-b border-border bg-muted/30">
        <Users className="h-4 w-4 text-accent" />
        <h3 className="font-heading font-semibold text-sm">Indicações</h3>
        <div className="flex items-center gap-1.5 ml-auto">
          {totalConfirmed > 0 && (
            <span className="text-[10px] text-success font-medium">{totalConfirmed} vendas</span>
          )}
          <Badge variant="muted" className="text-[10px]">{totalIndicated} indicados</Badge>
        </div>
      </div>

      {/* Summary */}
      {indications.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border border-border bg-card p-2">
            <p className="text-[10px] text-muted-foreground">Indicados</p>
            <p className="font-bold text-sm tabular">{totalIndicated}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-2">
            <p className="text-[10px] text-muted-foreground">Vendas</p>
            <p className="font-bold text-sm tabular text-success">{totalConfirmed}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-2">
            <p className="text-[10px] text-muted-foreground">Receita</p>
            <p className="font-bold text-sm tabular text-success">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={() => { resetForm(); setShowForm(!showForm) }}>
          <Plus className="mr-1 h-3 w-3" /> Registrar
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <p className="label-xs">{editingId ? 'Editar registro' : 'Nova indicação'}</p>
            {!editingId && (
              <p className="text-[10px] text-muted-foreground">O formulário fica aberto para adicionar em série</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ind-date">Data *</Label>
              <Input id="ind-date" type="date" value={indDate} onChange={(e) => setIndDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ind-qty">Qtd. indicados *</Label>
              <Input id="ind-qty" type="number" min="0" value={qtyIndicated} onChange={(e) => setQtyIndicated(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ind-confirmed">Qtd. vendas</Label>
              <Input id="ind-confirmed" type="number" min="0" value={qtyConfirmed} onChange={(e) => setQtyConfirmed(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ind-revenue">Receita gerada</Label>
              <Input
                id="ind-revenue"
                inputMode="numeric"
                value={revenueCents > 0 ? `R$ ${fmtCurrencyInd(revenueCents)}` : ''}
                placeholder="R$ 0,00"
                onChange={(e) => setRevenueCents(parseCurrencyInd(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ind-entry">Valor de entrada</Label>
              <Input
                id="ind-entry"
                inputMode="numeric"
                value={entryCents > 0 ? `R$ ${fmtCurrencyInd(entryCents)}` : ''}
                placeholder="R$ 0,00"
                onChange={(e) => setEntryCents(parseCurrencyInd(e.target.value))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => { resetForm(); setShowForm(false) }}>Fechar</Button>
            <Button type="submit" size="sm" disabled={indLoading}>
              {indLoading ? 'Salvando...' : editingId ? 'Salvar' : <><Plus className="h-3 w-3 mr-1" /> Adicionar</>}
            </Button>
          </div>
        </form>
      )}

      {indications.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <Users className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma indicação registrada</p>
          <Button size="sm" variant="ghost" className="mt-2 text-xs text-accent" onClick={() => { resetForm(); setShowForm(true) }}>
            <Plus className="h-3 w-3 mr-1" /> Registrar primeira
          </Button>
        </div>
      )}

      {indications.map((item) => (
        <div key={item.id} className="group rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/30">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {item.indication_date ? new Date(item.indication_date).toLocaleDateString('pt-BR') : 'Sem data'}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{item.quantity_indicated ?? 0} indicados</span>
                <span className="text-success">{item.quantity_confirmed ?? 0} vendas</span>
                {Number(item.revenue_generated) > 0 && (
                  <span className="text-success font-medium">R$ {Number(item.revenue_generated).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                )}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)} aria-label="Editar"><Pencil className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteInd(item.id)} aria-label="Excluir"><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        </div>
      ))}

      <Dialog open={!!confirmDeleteInd} onOpenChange={() => setConfirmDeleteInd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir indicação?</DialogTitle><DialogDescription>Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteInd(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirmDeleteInd && handleDelete(confirmDeleteInd)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tab: Eventos ───
function TabIntensivo({ menteeId }: { menteeId: string }) {
  const [intensivos, setIntensivos] = useState<IntensivoRecord[]>([])
  const [encontros, setEncontros] = useState<Database['public']['Tables']['presential_events']['Row'][]>([])

  const [showIntForm, setShowIntForm] = useState(false)
  const [intDate, setIntDate] = useState('')
  const [intLoading] = useState(false)

  const [showEncForm, setShowEncForm] = useState(false)
  const [encDate, setEncDate] = useState('')
  const [encLoading] = useState(false)

  const [confirmDeleteId, setConfirmDeleteId] = useState<{ id: string; type: 'intensivo' | 'encontro' } | null>(null)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase.from('intensivo_records').select('*').eq('mentee_id', menteeId).eq('participated', true)
      .order('created_at', { ascending: false }).then(({ data }) => { if (data) setIntensivos(data) })
    supabase.from('presential_events').select('*').eq('mentee_id', menteeId)
      .order('created_at', { ascending: false }).then(({ data }) => { if (data) setEncontros(data) })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchData() }, [fetchData])

  async function handleAddIntensivo(e: React.FormEvent) {
    e.preventDefault()
    // Optimistic: add placeholder and close form immediately
    const optimisticItem = {
      id: `temp-${Date.now()}`,
      mentee_id: menteeId,
      participated: true,
      participation_date: intDate || null,
      created_at: new Date().toISOString(),
    } as Database['public']['Tables']['intensivo_records']['Row']
    setIntensivos((prev) => [optimisticItem, ...prev])
    const savedDate = intDate
    setIntDate(''); setShowIntForm(false)

    try {
      await addIntensivoRecord(menteeId, { participated: true, participation_date: savedDate || undefined })
      fetchData()
    } catch {
      setIntensivos((prev) => prev.filter((i) => i.id !== optimisticItem.id))
      toast.error('Erro ao registrar participação')
    }
  }

  async function handleAddEncontro(e: React.FormEvent) {
    e.preventDefault()
    // Optimistic: add placeholder and close form immediately
    const optimisticItem = {
      id: `temp-${Date.now()}`,
      mentee_id: menteeId,
      event_date: encDate,
      created_at: new Date().toISOString(),
    } as { id: string; mentee_id: string; event_date: string; created_at: string }
    setEncontros((prev) => [optimisticItem as typeof prev[number], ...prev])
    const savedDate = encDate
    setEncDate(''); setShowEncForm(false)

    try {
      await supabase.from('presential_events').insert({ mentee_id: menteeId, event_date: savedDate })
      fetchData()
    } catch {
      setEncontros((prev) => prev.filter((i) => i.id !== optimisticItem.id))
      toast.error('Erro ao registrar encontro')
    }
  }

  async function handleDelete() {
    if (!confirmDeleteId) return
    const { id, type } = confirmDeleteId
    setConfirmDeleteId(null)
    if (type === 'intensivo') {
      setIntensivos((prev) => prev.filter((i) => i.id !== id))
      const undoTimeout = setTimeout(async () => { await deleteIntensivoRecord(id); fetchData() }, 5000)
      toast('Registro excluído', { action: { label: 'Desfazer', onClick: () => { clearTimeout(undoTimeout); fetchData() } }, duration: 5000 })
    } else {
      setEncontros((prev) => prev.filter((i) => i.id !== id))
      const undoTimeout = setTimeout(async () => { await supabase.from('presential_events').delete().eq('id', id); fetchData() }, 5000)
      toast('Registro excluído', { action: { label: 'Desfazer', onClick: () => { clearTimeout(undoTimeout); fetchData() } }, duration: 5000 })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ═══ Participação no Intensivo ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-xs uppercase">Participação no Intensivo ({intensivos.length})</p>
          <Button size="sm" variant="outline" onClick={() => setShowIntForm(!showIntForm)}>
            <Plus className="mr-1 h-3 w-3" /> Registrar
          </Button>
        </div>
        {showIntForm && (
          <form onSubmit={handleAddIntensivo} className="flex items-end gap-2 rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={intDate} onChange={(e) => setIntDate(e.target.value)} required className="h-8 text-xs" />
            </div>
            <Button type="submit" size="sm" className="h-8" disabled={intLoading}>{intLoading ? 'Salvando...' : 'Salvar'}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setShowIntForm(false)}>X</Button>
          </form>
        )}
        {intensivos.length === 0 && !showIntForm && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma participação registrada</p>
        )}
        {intensivos.map((item) => (
          <div key={item.id} className="group flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm hover:bg-muted/30">
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-[10px]">Participou</Badge>
              <span className="text-muted-foreground text-xs">{item.participation_date ? formatDateBR(item.participation_date) : '—'}</span>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setConfirmDeleteId({ id: item.id, type: 'intensivo' })}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>

      <Separator className="border-border/50" />

      {/* ═══ Encontro da Elite Premium ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-xs uppercase">Encontro da Elite Premium ({encontros.length})</p>
          <Button size="sm" variant="outline" onClick={() => setShowEncForm(!showEncForm)}>
            <Plus className="mr-1 h-3 w-3" /> Registrar
          </Button>
        </div>
        {showEncForm && (
          <form onSubmit={handleAddEncontro} className="flex items-end gap-2 rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={encDate} onChange={(e) => setEncDate(e.target.value)} required className="h-8 text-xs" />
            </div>
            <Button type="submit" size="sm" className="h-8" disabled={encLoading}>{encLoading ? 'Salvando...' : 'Salvar'}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setShowEncForm(false)}>X</Button>
          </form>
        )}
        {encontros.length === 0 && !showEncForm && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma participação registrada</p>
        )}
        {encontros.map((item) => (
          <div key={item.id} className="group flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm hover:bg-muted/30">
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-[10px]">Participou</Badge>
              <span className="text-muted-foreground text-xs">{item.event_date ? formatDateBR(item.event_date) : '—'}</span>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setConfirmDeleteId({ id: item.id, type: 'encontro' })}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir registro?</DialogTitle><DialogDescription>Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  { value: 'mentoria_comercial', label: 'Mentoria Comercial' },
  { value: 'mentoria_marketing', label: 'Mentoria de Marketing' },
  { value: 'mentoria_gestao', label: 'Mentoria de Gestão' },
  { value: 'hotseat', label: 'Hotseat' },
]

function TabTestimonials({ menteeId, mentee }: { menteeId: string; mentee: MenteeWithStats }) {
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
  const [viewingItem, setViewingItem] = useState<Testimonial | null>(null)
  const [defaultEmployeeCount, setDefaultEmployeeCount] = useState('')
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

  // Fetch num_colaboradores from action plan for auto-fill
  useEffect(() => {
    supabase
      .from('action_plans')
      .select('data')
      .eq('mentee_id', menteeId)
      .not('data', 'is', null)
      .maybeSingle()
      .then(({ data: ap }) => {
        if (ap?.data) {
          const d = ap.data as Record<string, unknown>
          if (d.num_colaboradores) setDefaultEmployeeCount(String(d.num_colaboradores))
        }
      })
  }, [menteeId]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <Button size="sm" variant="outline" onClick={() => {
          resetForm()
          if (!showForm) {
            if (mentee.niche) setNiche(mentee.niche)
            if (mentee.faturamento_atual != null) setRevenueRange(`R$ ${mentee.faturamento_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
            if (defaultEmployeeCount) setEmployeeCount(defaultEmployeeCount)
          }
          setShowForm(!showForm)
        }}>
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
      {/* Detail modal */}
      <Dialog open={!!viewingItem} onOpenChange={(open) => { if (!open) setViewingItem(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Depoimento</DialogTitle>
            <DialogDescription>
              {viewingItem?.testimonial_date ? formatDateBR(viewingItem.testimonial_date) : ''}
              {viewingItem?.niche ? ` · ${viewingItem.niche}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-foreground whitespace-pre-line">{viewingItem?.description}</p>
            {viewingItem?.attachment_url && (
              <div>
                {viewingItem.attachment_type === 'video' ? (
                  <video src={viewingItem.attachment_url} controls className="rounded-lg w-full max-h-[400px] object-contain bg-black" />
                ) : (
                  <Image src={viewingItem.attachment_url} alt="Depoimento" width={600} height={400} className="rounded-lg w-full object-contain" unoptimized />
                )}
              </div>
            )}
            {viewingItem?.categories && viewingItem.categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {viewingItem.categories.map((cat) => (
                  <Badge key={cat} variant="info" className="text-[10px]">
                    {TESTIMONIAL_CATEGORIES.find((c) => c.value === cat)?.label ?? cat}
                  </Badge>
                ))}
              </div>
            )}
            {viewingItem?.revenue_range && <p className="text-xs text-muted-foreground">Faturamento: {viewingItem.revenue_range}</p>}
            {viewingItem?.employee_count && <p className="text-xs text-muted-foreground">Colaboradores: {viewingItem.employee_count}</p>}
          </div>
        </DialogContent>
      </Dialog>

      {items.map((item) => (
        <div key={item.id} className="relative rounded-lg border border-border bg-card p-3 text-sm group cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setViewingItem(item)}>
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleEdit(item) }}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(item.id) }}
              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {confirmDeleteId === item.id && (
            <div className="mb-2 rounded-md bg-destructive/10 border border-destructive/20 p-2 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs text-destructive">Excluir este depoimento?</p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="destructive" className="h-6 text-xs px-2" onClick={() => handleDelete(item.id)} disabled={loading}>Excluir</Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pr-16">
            <p className="text-xs text-muted-foreground">{formatDateBR(item.testimonial_date)}</p>
            {item.niche && <Badge variant="outline" className="text-[10px]">{item.niche}</Badge>}
          </div>
          <p className="mt-1 text-foreground line-clamp-2">{item.description}</p>
          {item.attachment_url && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-accent">
              {item.attachment_type === 'video' ? '🎥 Vídeo anexado' : '📷 Imagem anexada'}
            </div>
          )}
          {item.categories && item.categories.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
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
