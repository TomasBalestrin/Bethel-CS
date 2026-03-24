'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Calendar,
  User,
  Phone,
  MapPin,
  Mail,
  AtSign,
  Briefcase,
  Pencil,
  Trash2,
  Star,
  FileDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  addIndication,
  addIntensivoRecord,
  addRevenueRecord,
  updateRevenueRecord,
  deleteRevenueRecord,
  addObjective,
  addTestimonial,
  updateTestimonial,
  deleteTestimonial,
  generateActionPlanLink,
  toggleClienteFit,
  addEngagementRecord,
  addCsActivity,
} from '@/lib/actions/panel-actions'
import type { MenteeWithStats } from '@/types/kanban'
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
}

export function MenteePanel({ mentee, open, onOpenChange }: MenteePanelProps) {
  if (!mentee) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-2xl p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <SheetTitle>{mentee.full_name}</SheetTitle>
            <Badge
              variant={
                ({ 1: 'muted', 2: 'warning', 3: 'info', 4: 'success', 5: 'accent' } as const)[
                  mentee.priority_level
                ] ?? 'muted'
              }
            >
              Nível {mentee.priority_level}
            </Badge>
          </div>
          <SheetDescription>{mentee.product_name}</SheetDescription>
        </SheetHeader>
        <Separator />
        <PanelTabs mentee={mentee} />
      </SheetContent>
    </Sheet>
  )
}

function PanelTabs({ mentee }: { mentee: MenteeWithStats }) {
  return (
    <Tabs defaultValue="info" className="flex flex-col h-[calc(100vh-120px)]">
      <TabsList className="mx-6 mt-4 flex-wrap h-auto gap-1 justify-start">
        <TabsTrigger value="info">Info</TabsTrigger>
        <TabsTrigger value="action-plan">Plano</TabsTrigger>
        <TabsTrigger value="indications">Indicações</TabsTrigger>
        <TabsTrigger value="intensivo">Intensivo</TabsTrigger>
        <TabsTrigger value="revenue">Receita</TabsTrigger>
        <TabsTrigger value="objectives">Objetivos</TabsTrigger>
        <TabsTrigger value="testimonials">Depoimentos</TabsTrigger>
        <TabsTrigger value="engagement">Engajamento</TabsTrigger>
      </TabsList>
      <ScrollArea className="flex-1 px-6 py-4">
        <TabsContent value="info"><TabInfo mentee={mentee} /></TabsContent>
        <TabsContent value="action-plan"><TabActionPlan mentee={mentee} /></TabsContent>
        <TabsContent value="indications"><TabIndications menteeId={mentee.id} /></TabsContent>
        <TabsContent value="intensivo"><TabIntensivo menteeId={mentee.id} /></TabsContent>
        <TabsContent value="revenue"><TabRevenue menteeId={mentee.id} /></TabsContent>
        <TabsContent value="objectives"><TabObjectives menteeId={mentee.id} /></TabsContent>
        <TabsContent value="testimonials"><TabTestimonials menteeId={mentee.id} /></TabsContent>
        <TabsContent value="engagement"><TabEngagement menteeId={mentee.id} /></TabsContent>
      </ScrollArea>
    </Tabs>
  )
}

// ─── Tab 1: Info Geral ───
function TabInfo({ mentee }: { mentee: MenteeWithStats }) {
  const fields = [
    { icon: User, label: 'Nome', value: mentee.full_name },
    { icon: Phone, label: 'Telefone', value: mentee.phone },
    { icon: Mail, label: 'Email', value: mentee.email },
    { icon: AtSign, label: 'Instagram', value: mentee.instagram },
    { icon: MapPin, label: 'Cidade/Estado', value: [mentee.city, mentee.state].filter(Boolean).join(', ') },
    { icon: Calendar, label: 'Nascimento', value: mentee.birth_date },
    { icon: Briefcase, label: 'Produto', value: mentee.product_name },
    { icon: Calendar, label: 'Início', value: mentee.start_date },
    { icon: Calendar, label: 'Término', value: mentee.end_date },
  ]

  return (
    <div className="space-y-3 animate-fade-in">
      {fields.map(({ icon: Icon, label, value }) => (
        value ? (
          <div key={label} className="flex items-center gap-3 text-sm">
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground w-24 shrink-0">{label}</span>
            <span className="text-foreground">{value}</span>
          </div>
        ) : null
      ))}
      {mentee.cpf && (
        <div className="flex items-center gap-3 text-sm">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-24 shrink-0">CPF</span>
          <span className="text-foreground">{mentee.cpf}</span>
        </div>
      )}
      {mentee.has_partner && mentee.partner_name && (
        <div className="flex items-center gap-3 text-sm">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-24 shrink-0">Sócio</span>
          <span className="text-foreground">{mentee.partner_name}</span>
        </div>
      )}
      {mentee.seller_name && (
        <div className="flex items-center gap-3 text-sm">
          <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-24 shrink-0">Vendedor</span>
          <span className="text-foreground">{mentee.seller_name}</span>
        </div>
      )}
      {mentee.funnel_origin && (
        <div className="flex items-center gap-3 text-sm">
          <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground w-24 shrink-0">Funil</span>
          <span className="text-foreground">{mentee.funnel_origin}</span>
        </div>
      )}
      <ClienteFitToggle menteeId={mentee.id} initialValue={mentee.cliente_fit} />
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
    <div className="flex items-center gap-3 text-sm pt-2 border-t border-border mt-2">
      <Star className={`h-4 w-4 shrink-0 ${fit ? 'text-warning fill-warning' : 'text-muted-foreground'}`} />
      <span className="text-muted-foreground w-24 shrink-0">Cliente Fit</span>
      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fit ? 'bg-warning' : 'bg-muted'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${fit ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
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

// ─── Tab 3: Indicações ───
function TabIndications({ menteeId }: { menteeId: string }) {
  const [items, setItems] = useState<Indication[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase
      .from('indications')
      .select('*')
      .eq('mentee_id', menteeId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setItems(data) })
  }, [menteeId, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await addIndication(menteeId, name, phone)
    setName(''); setPhone(''); setShowForm(false); setLoading(false)
    fetchData()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="label-xs">Indicações ({items.length})</p>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3 w-3" /> Registrar
        </Button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-1">
            <Label htmlFor="ind-name">Nome do indicado *</Label>
            <Input id="ind-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ind-phone">Telefone *</Label>
            <Input id="ind-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      )}
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-3 text-sm">
          <p className="font-medium text-foreground">{item.indicated_name}</p>
          <p className="text-muted-foreground">{item.indicated_phone}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Tab 4: Intensivo ───
function TabIntensivo({ menteeId }: { menteeId: string }) {
  const [items, setItems] = useState<IntensivoRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [participated, setParticipated] = useState(false)
  const [participationDate, setParticipationDate] = useState('')
  const [indName, setIndName] = useState('')
  const [indPhone, setIndPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase
      .from('intensivo_records')
      .select('*')
      .eq('mentee_id', menteeId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setItems(data) })
  }, [menteeId, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await addIntensivoRecord(menteeId, {
      participated,
      participation_date: participationDate || undefined,
      indication_name: indName || undefined,
      indication_phone: indPhone || undefined,
    })
    setParticipated(false); setParticipationDate(''); setIndName(''); setIndPhone('')
    setShowForm(false); setLoading(false)
    fetchData()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="label-xs">Intensivo ({items.length})</p>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3 w-3" /> Registrar
        </Button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="int-part" checked={participated} onChange={(e) => setParticipated(e.target.checked)} className="h-4 w-4 rounded border-input" />
            <Label htmlFor="int-part">Participou</Label>
          </div>
          {participated && (
            <div className="space-y-1">
              <Label htmlFor="int-date">Data de participação</Label>
              <Input id="int-date" type="date" value={participationDate} onChange={(e) => setParticipationDate(e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="int-name">Nome indicação intensivo</Label>
            <Input id="int-name" value={indName} onChange={(e) => setIndName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="int-phone">Telefone indicação</Label>
            <Input id="int-phone" value={indPhone} onChange={(e) => setIndPhone(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      )}
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex items-center gap-2">
            {item.participated ? <Badge variant="success">Participou</Badge> : <Badge variant="muted">Não participou</Badge>}
            {item.participation_date && <span className="text-muted-foreground text-xs">{item.participation_date}</span>}
          </div>
          {item.indication_name && (
            <p className="mt-1 text-muted-foreground">Indicação: {item.indication_name} — {item.indication_phone}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Tab 5: Receita Nova ───
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

// ─── Tab 6: Objetivos ───
function TabObjectives({ menteeId }: { menteeId: string }) {
  const [items, setItems] = useState<Objective[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [achievedAt, setAchievedAt] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchData = useCallback(() => {
    supabase
      .from('objectives')
      .select('*')
      .eq('mentee_id', menteeId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setItems(data) })
  }, [menteeId, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await addObjective(menteeId, {
      title,
      description: description || undefined,
      achieved_at: achievedAt || undefined,
    })
    setTitle(''); setDescription(''); setAchievedAt('')
    setShowForm(false); setLoading(false)
    fetchData()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="label-xs">Objetivos ({items.length})</p>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-3 w-3" /> Registrar
        </Button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
          <div className="space-y-1">
            <Label htmlFor="obj-title">Título *</Label>
            <Input id="obj-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="obj-desc">Descrição</Label>
            <Textarea id="obj-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="obj-date">Data de conquista</Label>
            <Input id="obj-date" type="date" value={achievedAt} onChange={(e) => setAchievedAt(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      )}
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border bg-card p-3 text-sm">
          <p className="font-medium text-foreground">{item.title}</p>
          {item.description && <p className="mt-1 text-muted-foreground">{item.description}</p>}
          {item.achieved_at && <p className="mt-1 text-xs text-muted-foreground">{item.achieved_at}</p>}
        </div>
      ))}
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
            <p className="text-xs text-muted-foreground">{item.testimonial_date}</p>
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
                <span className="text-xs text-muted-foreground">{item.recorded_at}</span>
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
                <span className="text-xs text-muted-foreground">{item.activity_date}</span>
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
