'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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
  Check,
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
  addObjective,
  updateObjective,
  deleteObjective,
  addTestimonial,
  updateTestimonial,
  deleteTestimonial,
  generateActionPlanLink,
  toggleClienteFit,
  addEngagementRecord,
  addCsActivity,
  updateMentee,
  deleteMentee,
} from '@/lib/actions/panel-actions'
import dynamic from 'next/dynamic'
import type { MenteeWithStats } from '@/types/kanban'

const TabChat = dynamic(
  () => import('./tab-chat').then((mod) => ({ default: mod.TabChat })),
  { ssr: false }
)
import type { Database, TestimonialCategory, EngagementType, CsActivityType, RevenueType } from '@/types/database'

type Indication = Database['public']['Tables']['indications']['Row']
type IntensivoRecord = Database['public']['Tables']['intensivo_records']['Row']
type RevenueRecord = Database['public']['Tables']['revenue_records']['Row']
type Objective = Database['public']['Tables']['objectives']['Row']
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

export function MenteePanel({ mentee, open, onOpenChange, onMenteeDeleted, onMenteeUpdated, onTransitionToMentorship }: MenteePanelProps) {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function fetchRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setUserRole(profile?.role ?? null)
    }
    if (open) fetchRole()
  }, [open])

  // Reset edit state when panel closes
  useEffect(() => {
    if (!open) setEditing(false)
  }, [open])

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-full p-0 sm:min-w-[580px] sm:max-w-[680px] h-[100dvh] sm:h-full rounded-none">
        <SheetHeader className="px-4 pt-3 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <SheetTitle className="font-heading font-semibold text-xl leading-tight truncate">
                {mentee.full_name}
              </SheetTitle>
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
            {isAdmin && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing((e) => !e)}
                  className="text-xs h-7 px-2"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  {editing ? 'Cancelar' : 'Editar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteOpen(true)}
                  className="text-xs h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Excluir
                </Button>
              </div>
            )}
          </div>
          <SheetDescription className="text-sm text-muted-foreground">
            {mentee.product_name}
          </SheetDescription>
          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Headphones size={12} />
              {mentee.attendance_count} atendimentos
            </span>
            <span className="inline-flex items-center gap-1">
              <Users size={12} />
              {mentee.indication_count} indicações
            </span>
            <span className="inline-flex items-center gap-1">
              <DollarSign size={12} />
              R$ {(mentee.revenue_total / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} receita nova
            </span>
          </div>
        </SheetHeader>
        <Separator />
        <PanelTabs
          mentee={mentee}
          editing={editing}
          setEditing={setEditing}
          onMenteeUpdated={onMenteeUpdated}
          isAdmin={isAdmin}
          onTransitionToMentorship={onTransitionToMentorship}
        />

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
      </SheetContent>
    </Sheet>
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
    <Tabs defaultValue="info" className="flex flex-col h-[calc(100vh-180px)]">
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
              { value: 'objectives', label: 'Objetivos' },
              { value: 'revenue', label: 'Receita' },
              { value: 'testimonials', label: 'Depoimentos' },
              { value: 'chat', label: 'Chat' },
              { value: 'engagement', label: 'Engajamento' },
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
      <ScrollArea className="flex-1 px-4 py-4 sm:px-6">
        <TabsContent value="info">
          <TabInfo
            mentee={mentee}
            editing={editing}
            setEditing={setEditing}
            onMenteeUpdated={onMenteeUpdated}
            isAdmin={isAdmin}
            onTransitionToMentorship={onTransitionToMentorship}
          />
        </TabsContent>
        <TabsContent value="action-plan"><TabActionPlan mentee={mentee} /></TabsContent>
        <TabsContent value="objectives"><TabObjectives menteeId={mentee.id} /></TabsContent>
        <TabsContent value="revenue"><TabRevenue menteeId={mentee.id} /></TabsContent>
        <TabsContent value="testimonials"><TabTestimonials menteeId={mentee.id} /></TabsContent>
        <TabsContent value="engagement"><TabEngagement menteeId={mentee.id} /></TabsContent>
        <TabsContent value="chat">
          <TabChat
            menteeId={mentee.id}
            menteePhone={mentee.phone}
            menteeName={mentee.full_name}
            specialistId={mentee.created_by}
            onUnreadCountChange={setChatUnread}
          />
        </TabsContent>
      </ScrollArea>
    </Tabs>
  )
}

// ─── Info field row ───
function InfoRow({ label, value, render }: { label: string; value?: string | null; render?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {render ?? <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || '—'}</span>}
    </div>
  )
}

// ─── Section header ───
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
      {children}
    </h3>
  )
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
      start_date: form.start_date,
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
          <EditField label="Início" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} type="date" />
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

  // ─── View mode — 2 column grouped layout ───
  return (
    <div className="animate-fade-in space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
        {/* Dados Pessoais */}
        <div>
          <SectionTitle>Dados Pessoais</SectionTitle>
          <div className="divide-y divide-border/50">
            <InfoRow label="Nome" value={mentee.full_name} />
            <InfoRow label="CPF" value={mentee.cpf} />
            <InfoRow label="Nascimento" value={mentee.birth_date ? formatDateBR(mentee.birth_date) : null} />
            <InfoRow label="Telefone" value={mentee.phone} />
            <InfoRow label="Email" value={mentee.email} />
            <InfoRow
              label="Instagram"
              value={mentee.instagram}
              render={
                instHandle ? (
                  <a
                    href={`https://instagram.com/${instHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline hover:opacity-80 transition-opacity inline-flex items-center gap-1 text-sm"
                  >
                    <AtSign size={14} />
                    {instHandle}
                  </a>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )
              }
            />
            <InfoRow label="Cidade/Estado" value={[mentee.city, mentee.state].filter(Boolean).join(', ') || null} />
          </div>
        </div>

        {/* Dados da Mentoria */}
        <div>
          <SectionTitle>Dados da Mentoria</SectionTitle>
          <div className="divide-y divide-border/50">
            <InfoRow label="Produto" value={mentee.product_name} />
            <InfoRow label="Início" value={mentee.start_date ? formatDateBR(mentee.start_date) : null} />
            <InfoRow label="Término" value={mentee.end_date ? formatDateBR(mentee.end_date) : null} />
            <InfoRow label="Vendedor" value={mentee.seller_name} />
            <InfoRow label="Funil" value={mentee.funnel_origin} />
            <InfoRow label="Status" value={
              mentee.status === 'ativo' ? 'Ativo' :
              mentee.status === 'cancelado' ? 'Cancelado' :
              mentee.status === 'concluido' ? 'Concluído' : mentee.status
            } />
          </div>
        </div>
      </div>

      {/* Closer / Venda — only if source starts with webhook or has closer fields */}
      {(mentee.niche || mentee.main_pain || mentee.main_difficulty || mentee.contract_validity || mentee.closer_name || mentee.transcription) && (
        <div className="border-t border-border/50 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div>
              <SectionTitle>Closer / Venda</SectionTitle>
              <div className="divide-y divide-border/50">
                <InfoRow label="Nicho" value={mentee.niche} />
                <InfoRow label="Dor principal" value={mentee.main_pain} />
                <InfoRow label="Dificuldade principal" value={mentee.main_difficulty} />
                <InfoRow label="Closer" value={mentee.closer_name} />
              </div>
            </div>
            <div>
              <SectionTitle>Contrato</SectionTitle>
              <div className="divide-y divide-border/50">
                <InfoRow label="Validade" value={mentee.contract_validity} />
                <InfoRow label="Origem" value={mentee.source} />
              </div>
            </div>
          </div>
          {mentee.transcription && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1">Transcrição da call</p>
              <div className="rounded-md bg-muted/50 p-3 text-xs text-foreground max-h-32 overflow-y-auto whitespace-pre-wrap">
                {mentee.transcription}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sociedade — only if has_partner */}
      {mentee.has_partner && (
        <div className="border-t border-border/50 pt-4">
          <SectionTitle>Sociedade</SectionTitle>
          <div className="divide-y divide-border/50">
            <InfoRow label="Entrou com sócio" value="Sim" />
            <InfoRow label="Nome do sócio" value={mentee.partner_name} />
          </div>
        </div>
      )}

      {/* Classificação */}
      <div className="border-t border-border/50 pt-4">
        <SectionTitle>Classificação</SectionTitle>
        <div className="divide-y divide-border/50">
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-xs text-muted-foreground">Nível de prioridade</span>
            <Badge
              variant={
                ({ 1: 'muted', 2: 'warning', 3: 'info', 4: 'success', 5: 'accent' } as const)[
                  mentee.priority_level
                ] ?? 'muted'
              }
            >
              P{mentee.priority_level}
            </Badge>
          </div>
          <div className="flex items-center justify-between py-2 text-sm">
            <span className="text-xs text-muted-foreground">Cliente Fit</span>
            <ClienteFitToggle menteeId={mentee.id} initialValue={mentee.cliente_fit} />
          </div>
        </div>
      </div>

      {/* Link do Chat */}
      {mentee.chat_token && (
        <div className="border-t border-border/50 pt-4">
          <SectionTitle>Link do Chat</SectionTitle>
          <ChatLinkCopy chatToken={mentee.chat_token} />
        </div>
      )}

      {/* Transition to Mentorship button — admin only, initial kanban only */}
      {isAdmin && mentee.kanban_type === 'initial' && onTransitionToMentorship && (
        <div className="border-t border-border/50 pt-4">
          <Button
            variant="outline"
            onClick={() => onTransitionToMentorship(mentee)}
            className="w-full text-sm"
          >
            Enviar para Etapas Mentoria
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
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

function ChatLinkCopy({ chatToken }: { chatToken: string }) {
  const [copied, setCopied] = useState(false)
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/chat/${chatToken}`

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Link copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 py-2">
      <Input
        readOnly
        value={url}
        className="text-xs h-8 bg-muted/50 flex-1"
        onFocus={(e) => e.target.select()}
      />
      <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={handleCopy}>
        {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
      </Button>
    </div>
  )
}

// ─── Tab 2: Plano de Ação ───

const ACTION_PLAN_LABELS: Record<string, string> = {
  endereco_completo: 'Endereço completo',
  como_nos_conheceu: 'Por onde nos conheceu',
  motivacao_elite_premium: 'Por que decidiu entrar na Elite Premium',
  expectativas_resultados: 'Expectativas de resultado',
  atuacao_profissional: 'Atuação profissional',
  tempo_atuacao: 'Tempo de atuação',
  produtos_servicos: 'Principais produtos/serviços',
  funis_venda: 'Funis de venda ativos',
  processo_venda: 'Processo de venda',
  media_faturamento: 'Faturamento médio mensal',
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

function ActionPlanResponseView({ data }: { data: Record<string, unknown> }) {
  const keys = Object.keys(ACTION_PLAN_LABELS)

  return (
    <div className="space-y-0 divide-y divide-border/60">
      {keys.map((key) => {
        const value = data[key]
        if (value === undefined || value === null || value === '') return null
        const label = ACTION_PLAN_LABELS[key]
        const isPill = PILL_KEYS.has(key)

        return (
          <div key={key} className="py-4 first:pt-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
              {label}
            </p>
            {isPill && Array.isArray(value) ? (
              <div className="flex flex-wrap gap-1.5">
                {value.map((v: string) => (
                  <span
                    key={v}
                    className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent"
                  >
                    {v}
                  </span>
                ))}
              </div>
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
  }, [mentee.id, supabase])

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
            <div className="rounded-md bg-muted p-3">
              <p className="label-xs mb-1">Link do formulário</p>
              <div className="flex items-start gap-2">
                <code className="flex-1 text-xs text-foreground break-all">{link}</code>
                <Button
                  size="sm"
                  variant={copied ? 'default' : 'outline'}
                  onClick={handleCopyLink}
                  className="shrink-0 text-xs"
                >
                  {copied ? 'Link copiado!' : 'Copiar link'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
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
  }, [menteeId, supabase])

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
    const confirmed = window.confirm('Excluir este registro de receita?')
    if (!confirmed) return
    setDeletingId(recordId)
    await deleteRevenueRecord(recordId)
    setDeletingId(null)
    fetchData()
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
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-success/10 px-4 py-2">
          <p className="label-xs">Total Crossell/Upsell</p>
          <p className="font-heading text-lg font-bold text-success tabular">
            R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
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
          <div className="grid grid-cols-2 gap-3">
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

// ─── Tab: Objetivos (unified: Objetivos + Indicações CS + Intensivo) ───
function TabObjectives({ menteeId }: { menteeId: string }) {
  // Objectives state
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [showObjForm, setShowObjForm] = useState(false)
  const [editingObjId, setEditingObjId] = useState<string | null>(null)
  const [objTitle, setObjTitle] = useState('')
  const [objDescription, setObjDescription] = useState('')
  const [objAchievedAt, setObjAchievedAt] = useState('')
  const [objLoading, setObjLoading] = useState(false)
  const [confirmDeleteObj, setConfirmDeleteObj] = useState<string | null>(null)

  // Indications state
  const [indications, setIndications] = useState<Indication[]>([])
  const [showIndForm, setShowIndForm] = useState(false)
  const [editingIndId, setEditingIndId] = useState<string | null>(null)
  const [indName, setIndName] = useState('')
  const [indPhone, setIndPhone] = useState('')
  const [indLoading, setIndLoading] = useState(false)
  const [confirmDeleteInd, setConfirmDeleteInd] = useState<string | null>(null)

  // Intensivo state
  const [intensivos, setIntensivos] = useState<IntensivoRecord[]>([])
  const [showIntForm, setShowIntForm] = useState(false)
  const [editingIntId, setEditingIntId] = useState<string | null>(null)
  const [intParticipated, setIntParticipated] = useState(false)
  const [intDate, setIntDate] = useState('')
  const [intIndName, setIntIndName] = useState('')
  const [intIndPhone, setIntIndPhone] = useState('')
  const [intLoading, setIntLoading] = useState(false)
  const [confirmDeleteInt, setConfirmDeleteInt] = useState<string | null>(null)

  const supabase = createClient()

  const fetchAll = useCallback(() => {
    supabase.from('objectives').select('*').eq('mentee_id', menteeId)
      .order('created_at', { ascending: false }).then(({ data }) => { if (data) setObjectives(data) })
    supabase.from('indications').select('*').eq('mentee_id', menteeId)
      .order('created_at', { ascending: false }).then(({ data }) => { if (data) setIndications(data) })
    supabase.from('intensivo_records').select('*').eq('mentee_id', menteeId)
      .order('created_at', { ascending: false }).then(({ data }) => { if (data) setIntensivos(data) })
  }, [menteeId, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── Objectives handlers ───
  function openEditObj(obj: Objective) {
    setEditingObjId(obj.id); setObjTitle(obj.title); setObjDescription(obj.description || ''); setObjAchievedAt(obj.achieved_at || '')
    setShowObjForm(true)
  }
  function resetObjForm() {
    setEditingObjId(null); setObjTitle(''); setObjDescription(''); setObjAchievedAt(''); setShowObjForm(false)
  }
  async function handleSubmitObj(e: React.FormEvent) {
    e.preventDefault(); setObjLoading(true)
    if (editingObjId) {
      await updateObjective(editingObjId, { title: objTitle, description: objDescription || undefined, achieved_at: objAchievedAt || undefined })
    } else {
      await addObjective(menteeId, { title: objTitle, description: objDescription || undefined, achieved_at: objAchievedAt || undefined })
    }
    resetObjForm(); setObjLoading(false); fetchAll()
  }
  async function handleDeleteObj(id: string) {
    await deleteObjective(id); setConfirmDeleteObj(null); fetchAll()
  }

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
    await deleteIndication(id); setConfirmDeleteInd(null); fetchAll()
  }

  // ─── Intensivo handlers ───
  function openEditInt(rec: IntensivoRecord) {
    setEditingIntId(rec.id); setIntParticipated(rec.participated); setIntDate(rec.participation_date || '')
    setIntIndName(rec.indication_name || ''); setIntIndPhone(rec.indication_phone || '')
    setShowIntForm(true)
  }
  function resetIntForm() {
    setEditingIntId(null); setIntParticipated(false); setIntDate(''); setIntIndName(''); setIntIndPhone(''); setShowIntForm(false)
  }
  async function handleSubmitInt(e: React.FormEvent) {
    e.preventDefault(); setIntLoading(true)
    const data = { participated: intParticipated, participation_date: intDate || undefined, indication_name: intIndName || undefined, indication_phone: intIndPhone || undefined }
    if (editingIntId) {
      await updateIntensivoRecord(editingIntId, data)
    } else {
      await addIntensivoRecord(menteeId, data)
    }
    resetIntForm(); setIntLoading(false); fetchAll()
  }
  async function handleDeleteInt(id: string) {
    await deleteIntensivoRecord(id); setConfirmDeleteInt(null); fetchAll()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ═══ SEÇÃO 1: Objetivos ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-xs uppercase">Objetivos ({objectives.length})</p>
          <Button size="sm" variant="outline" onClick={() => { resetObjForm(); setShowObjForm(!showObjForm) }}>
            <Plus className="mr-1 h-3 w-3" /> Registrar objetivo
          </Button>
        </div>

        {/* Objective form dialog */}
        <Dialog open={showObjForm} onOpenChange={(open) => { if (!open) resetObjForm() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingObjId ? 'Editar objetivo' : 'Novo objetivo'}</DialogTitle>
              <DialogDescription>Registre um objetivo atingido pelo mentorado.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitObj} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="obj-title">Título *</Label>
                <Input id="obj-title" value={objTitle} onChange={(e) => setObjTitle(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="obj-desc">Descrição</Label>
                <Textarea id="obj-desc" value={objDescription} onChange={(e) => setObjDescription(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="obj-date">Data de conquista</Label>
                <Input id="obj-date" type="date" value={objAchievedAt} onChange={(e) => setObjAchievedAt(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetObjForm}>Cancelar</Button>
                <Button type="submit" disabled={objLoading}>{objLoading ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {objectives.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhum registro ainda</p>
          </div>
        )}
        {objectives.map((item) => (
          <div key={item.id} className="group rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{item.title}</p>
                {item.description && <p className="mt-1 text-muted-foreground">{item.description}</p>}
                {item.achieved_at && <p className="mt-1 text-xs text-muted-foreground">{formatDateBR(item.achieved_at)}</p>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditObj(item)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteObj(item.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
        ))}
        {/* Confirm delete objective */}
        <Dialog open={!!confirmDeleteObj} onOpenChange={() => setConfirmDeleteObj(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Excluir objetivo?</DialogTitle><DialogDescription>Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDeleteObj(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => confirmDeleteObj && handleDeleteObj(confirmDeleteObj)}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Separator className="border-border/50" />

      {/* ═══ SEÇÃO 2: Indicações CS ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-xs uppercase">Indicações CS ({indications.length})</p>
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
            <p className="text-sm">Nenhum registro ainda</p>
          </div>
        )}
        {indications.map((item) => (
          <div key={item.id} className="group rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{item.indicated_name}</p>
                <p className="text-muted-foreground">{item.indicated_phone}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditInd(item)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteInd(item.id)}><Trash2 className="h-3 w-3" /></Button>
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

      <Separator className="border-border/50" />

      {/* ═══ SEÇÃO 3: Intensivo ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="label-xs uppercase">Intensivo ({intensivos.length})</p>
          <Button size="sm" variant="outline" onClick={() => { resetIntForm(); setShowIntForm(!showIntForm) }}>
            <Plus className="mr-1 h-3 w-3" /> Registrar
          </Button>
        </div>

        <Dialog open={showIntForm} onOpenChange={(open) => { if (!open) resetIntForm() }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingIntId ? 'Editar registro' : 'Novo registro intensivo'}</DialogTitle>
              <DialogDescription>Registre participação ou indicação para o intensivo.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitInt} className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="int-part" checked={intParticipated} onChange={(e) => setIntParticipated(e.target.checked)} className="h-4 w-4 rounded border-input" />
                <Label htmlFor="int-part">Participou</Label>
              </div>
              {intParticipated && (
                <div className="space-y-1">
                  <Label htmlFor="int-date">Data de participação</Label>
                  <Input id="int-date" type="date" value={intDate} onChange={(e) => setIntDate(e.target.value)} />
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="int-ind-name">Nome indicação intensivo</Label>
                <Input id="int-ind-name" value={intIndName} onChange={(e) => setIntIndName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="int-ind-phone">Telefone indicação</Label>
                <Input id="int-ind-phone" value={intIndPhone} onChange={(e) => setIntIndPhone(e.target.value)} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetIntForm}>Cancelar</Button>
                <Button type="submit" disabled={intLoading}>{intLoading ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {intensivos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Users className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhum registro ainda</p>
          </div>
        )}
        {intensivos.map((item) => (
          <div key={item.id} className="group rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {item.participated ? <Badge variant="success">Participou</Badge> : <Badge variant="muted">Não participou</Badge>}
                  {item.participation_date && <span className="text-muted-foreground text-xs">{formatDateBR(item.participation_date)}</span>}
                </div>
                {item.indication_name && (
                  <p className="mt-1 text-muted-foreground">Indicação: {item.indication_name} — {item.indication_phone}</p>
                )}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditInt(item)}><Pencil className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDeleteInt(item.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
        ))}
        <Dialog open={!!confirmDeleteInt} onOpenChange={() => setConfirmDeleteInt(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Excluir registro?</DialogTitle><DialogDescription>Esta ação não pode ser desfeita.</DialogDescription></DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDeleteInt(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => confirmDeleteInt && handleDeleteInt(confirmDeleteInt)}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
  }, [menteeId, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  function toggleCategory(cat: TestimonialCategory) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  function resetForm() {
    setTestimonialDate(''); setDescription(''); setNiche(''); setRevenueRange('')
    setEmployeeCount(''); setCategories([]); setEditingId(null)
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
    setLoading(true)
    await deleteTestimonial(id)
    setConfirmDeleteId(null)
    setLoading(false)
    fetchData()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (editingId) {
      await updateTestimonial(editingId, {
        testimonial_date: testimonialDate,
        description,
        niche: niche || undefined,
        revenue_range: revenueRange || undefined,
        employee_count: employeeCount || undefined,
        categories,
      })
    } else {
      await addTestimonial(menteeId, {
        testimonial_date: testimonialDate,
        description,
        niche: niche || undefined,
        revenue_range: revenueRange || undefined,
        employee_count: employeeCount || undefined,
        categories,
      })
    }

    resetForm()
    setShowForm(false); setLoading(false)
    fetchData()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="label-xs">Depoimentos ({items.length})</p>
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
          <div className="grid grid-cols-3 gap-3">
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
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
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

// ─── Tab 8: Engajamento ───
const ENGAGEMENT_LABELS: Record<EngagementType, string> = {
  aula: 'Área de Membros (Mentorfy)',
  live: 'Mentoria ao Vivo',
  evento: 'Evento',
  whatsapp_contato: 'Canal do Especialista',
}

const CS_ACTIVITY_LABELS: Record<CsActivityType, string> = {
  ligacao: 'Ligação',
  whatsapp: 'WhatsApp',
}

type CsActivity = Database['public']['Tables']['cs_activities']['Row']

function TabEngagement({ menteeId }: { menteeId: string }) {
  const [engagements, setEngagements] = useState<EngagementRecord[]>([])
  const [activities, setActivities] = useState<CsActivity[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState<'engagement' | 'cs'>('engagement')
  // engagement fields
  const [engType, setEngType] = useState<EngagementType>('aula')
  const [engValue, setEngValue] = useState('')
  const [engNotes, setEngNotes] = useState('')
  const [engDate, setEngDate] = useState('')
  // cs activity fields
  const [csType, setCsType] = useState<CsActivityType>('ligacao')
  const [csDuration, setCsDuration] = useState('')
  const [csNotes, setCsNotes] = useState('')
  const [csDate, setCsDate] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase
      .from('engagement_records')
      .select('*')
      .eq('mentee_id', menteeId)
      .order('recorded_at', { ascending: false })
      .then(({ data }) => { if (data) setEngagements(data) })
    supabase
      .from('cs_activities')
      .select('*')
      .eq('mentee_id', menteeId)
      .order('activity_date', { ascending: false })
      .then(({ data }) => { if (data) setActivities(data) })
  }, [menteeId, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSubmitEngagement(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await addEngagementRecord(menteeId, {
      type: engType,
      value: parseFloat(engValue),
      notes: engNotes || undefined,
      recorded_at: engDate,
    })
    setEngValue(''); setEngNotes(''); setEngDate('')
    setShowForm(false); setLoading(false)
    fetchData()
  }

  async function handleSubmitCsActivity(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await addCsActivity(menteeId, {
      type: csType,
      duration_minutes: parseInt(csDuration, 10),
      notes: csNotes || undefined,
      activity_date: csDate,
    })
    setCsDuration(''); setCsNotes(''); setCsDate('')
    setShowForm(false); setLoading(false)
    fetchData()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="label-xs">Engajamento & Atividades CS</p>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3 w-3" /> Registrar
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={formMode === 'engagement' ? 'default' : 'outline'} onClick={() => setFormMode('engagement')}>
              Engajamento
            </Button>
            <Button type="button" size="sm" variant={formMode === 'cs' ? 'default' : 'outline'} onClick={() => setFormMode('cs')}>
              Atividade CS
            </Button>
          </div>

          {formMode === 'engagement' ? (
            <form onSubmit={handleSubmitEngagement} className="space-y-3">
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={engType} onValueChange={(v) => setEngType(v as EngagementType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aula">Área de Membros (Mentorfy)</SelectItem>
                    <SelectItem value="live">Mentoria ao Vivo</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="whatsapp_contato">Canal do Especialista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="eng-value">Quantidade *</Label>
                  <Input id="eng-value" type="number" step="0.01" value={engValue} onChange={(e) => setEngValue(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="eng-date">Data *</Label>
                  <Input id="eng-date" type="date" value={engDate} onChange={(e) => setEngDate(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="eng-notes">Observação</Label>
                <Input id="eng-notes" value={engNotes} onChange={(e) => setEngNotes(e.target.value)} />
              </div>
              <Button type="submit" size="sm" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
            </form>
          ) : (
            <form onSubmit={handleSubmitCsActivity} className="space-y-3">
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={csType} onValueChange={(v) => setCsType(v as CsActivityType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="cs-duration">Duração (min) *</Label>
                  <Input id="cs-duration" type="number" value={csDuration} onChange={(e) => setCsDuration(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cs-date">Data *</Label>
                  <Input id="cs-date" type="date" value={csDate} onChange={(e) => setCsDate(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cs-notes">Observação</Label>
                <Input id="cs-notes" value={csNotes} onChange={(e) => setCsNotes(e.target.value)} />
              </div>
              <Button type="submit" size="sm" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
            </form>
          )}
        </div>
      )}

      {engagements.length > 0 && (
        <div className="space-y-2">
          <p className="label-xs text-muted-foreground">Engajamento</p>
          {engagements.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <Badge variant="info" className="text-[10px]">{ENGAGEMENT_LABELS[item.type]}</Badge>
                <span className="text-xs text-muted-foreground">{formatDateBR(item.recorded_at)}</span>
              </div>
              <p className="mt-1 text-foreground tabular">Quantidade: {Number(item.value)}</p>
              {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {activities.length > 0 && (
        <div className="space-y-2">
          <p className="label-xs text-muted-foreground">Atividades CS</p>
          {activities.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <Badge variant={item.type === 'whatsapp' ? 'success' : 'warning'} className="text-[10px]">
                  {CS_ACTIVITY_LABELS[item.type]}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatDateBR(item.activity_date)}</span>
              </div>
              <p className="mt-1 text-foreground tabular">Duração: {Number(item.duration_minutes)} min</p>
              {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {engagements.length === 0 && activities.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum registro.</p>
      )}
    </div>
  )
}
