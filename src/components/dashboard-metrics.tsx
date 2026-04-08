'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  UserPlus,
  DollarSign,
  MessageSquareQuote,
  Phone,
  MessageCircle,
  TrendingUp,
  Star,
  BookOpen,
  Video,
  CalendarCheck,
  Headphones,
  Database,
  Cake,
  ChevronRight,
} from 'lucide-react'
import { MenteeFilters, EMPTY_FILTERS, type MenteeFilterValues } from '@/components/mentee-filters'

interface DashboardMetricsProps {
  userName: string
  specialists: { id: string; full_name: string }[]
  isAdmin?: boolean
  filters: {
    specialistId: string | null
    startDate: string | null
    endDate: string | null
    fitFilter: string | null
  }
  advancedFilters: MenteeFilterValues
  filterOptions: {
    funisOrigem: string[]
    closers: string[]
    nichos: string[]
  }
  section2: {
    totalMentees: number
    fitMentees: number
    totalIndications: number
  }
  section3: {
    totalFaturamentoAtual: number
    totalTestimonials: number
    menteesWithTestimonial: number
    menteesAdvanced: number
    growthPct: number
    growthCount: number
    growthTotal: number
    totalMentees: number
  }
  engajamento: {
    deliveryStats: Record<string, { delivered: number; participated: number }>
    eventos: number
    intensivo: number
    encontro: number
  }
  section4: {
    totalLigacoes: number
    totalLigacaoDuration: number
    totalWhatsapp: number
    totalWhatsappIn: number
    totalAtendimentos: number
    atendimentosMentee: number
    atendimentosCS: number
    avgWaitMinutes: number
    avgManualAttendanceMinutes: number
    totalAttendanceMinutes: number
    avgAttendanceMinutes: number
  }
  section5: {
    crossell: number
    upsell: number
    indicacao_perpetuo: number
    indicacao_intensivo: number
    total: number
  }
  birthdayMentees: { id: string; full_name: string; daysUntil: number }[]
}

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60)
  const min = Math.round(m % 60)
  return h > 0 ? `${h}h ${min}min` : `${min}min`
}

export function DashboardMetrics(props: DashboardMetricsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Debounced date filters — wait 500ms before navigating
  const [startLocal, setStartLocal] = useState(props.filters.startDate ?? '')
  const [endLocal, setEndLocal] = useState(props.filters.endDate ?? '')

  const pushParams = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== '__all__') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/?${params.toString()}`)
  }, [router, searchParams])

  // Debounce start date
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get('start') ?? ''
      if (startLocal !== current) pushParams('start', startLocal)
    }, 500)
    return () => clearTimeout(timer)
  }, [startLocal, searchParams, pushParams])

  // Debounce end date
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get('end') ?? ''
      if (endLocal !== current) pushParams('end', endLocal)
    }, 500)
    return () => clearTimeout(timer)
  }, [endLocal, searchParams, pushParams])

  function updateFilter(key: string, value: string) {
    pushParams(key, value)
  }

  // Advanced filters — debounced for currency inputs
  const [localAdvFilters, setLocalAdvFilters] = useState<MenteeFilterValues>(props.advancedFilters)

  const handleAdvFilterChange = useCallback((key: keyof MenteeFilterValues, value: string) => {
    setLocalAdvFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Debounce currency filter changes (500ms), push non-currency immediately
  useEffect(() => {
    const currencyKeys: (keyof MenteeFilterValues)[] = ['fatInicialMin', 'fatInicialMax', 'fatAtualMin', 'fatAtualMax']
    const timer = setTimeout(() => {
      for (const key of currencyKeys) {
        const current = searchParams.get(key) ?? ''
        const local = localAdvFilters[key] || ''
        if (local !== current) {
          pushParams(key, local)
        }
      }
    }, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localAdvFilters.fatInicialMin, localAdvFilters.fatInicialMax, localAdvFilters.fatAtualMin, localAdvFilters.fatAtualMax])

  // Non-currency filters: push immediately on change
  useEffect(() => {
    const nonCurrencyKeys: (keyof MenteeFilterValues)[] = ['funilOrigem', 'closer', 'mesAniversario', 'numColaboradores', 'estado', 'nicho', 'dataInicio', 'dataTermino']
    for (const key of nonCurrencyKeys) {
      const current = searchParams.get(key) ?? ''
      const local = localAdvFilters[key] || ''
      if (local !== current) {
        pushParams(key, local)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localAdvFilters.funilOrigem, localAdvFilters.closer, localAdvFilters.mesAniversario, localAdvFilters.numColaboradores, localAdvFilters.estado, localAdvFilters.nicho, localAdvFilters.dataInicio, localAdvFilters.dataTermino])

  const handleClearAdvFilters = useCallback(() => {
    setLocalAdvFilters(EMPTY_FILTERS)
    const params = new URLSearchParams(searchParams.toString())
    const advKeys: (keyof MenteeFilterValues)[] = ['fatInicialMin', 'fatInicialMax', 'fatAtualMin', 'fatAtualMax', 'funilOrigem', 'closer', 'mesAniversario', 'numColaboradores', 'estado', 'nicho', 'dataInicio', 'dataTermino']
    for (const key of advKeys) {
      params.delete(key)
    }
    router.push(`/?${params.toString()}`)
  }, [router, searchParams])

  return (
    <div className="space-y-6">
      {/* Birthday Banner */}
      {props.birthdayMentees.length > 0 && (
        <section className="rounded-xl border border-accent/30 bg-accent/10 p-4 shadow-sm animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-accent/20 p-2.5 shrink-0">
              <Cake className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-semibold text-sm text-foreground">
                {props.birthdayMentees.some((m) => m.daysUntil === 0)
                  ? 'Aniversariantes hoje!'
                  : 'Aniversariantes nos pr\u00f3ximos dias'
                }
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Envie um áudio de parabéns para esses mentorados
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {props.birthdayMentees.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => router.push(`/mentorados?open=${m.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-card border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
                  >
                    <Cake className="h-3.5 w-3.5 text-accent" />
                    {m.full_name}
                    {m.daysUntil === 0 ? (
                      <span className="text-[10px] font-bold text-white bg-accent rounded-full px-1.5 py-0.5">HOJE</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">em {m.daysUntil} dia{m.daysUntil !== 1 ? 's' : ''}</span>
                    )}
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Header */}
      <div>
        <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
          Bem-vindo, {props.userName || 'Especialista'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Painel do Customer Success</p>
      </div>

      {/* ═══ FILTROS ═══ */}
      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="label-xs">Filtros</p>
        </div>
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${props.isAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {props.isAdmin && (
            <div className="space-y-1">
              <Label className="text-xs">Especialista</Label>
              <Select value={props.filters.specialistId ?? '__all__'} onValueChange={(v) => updateFilter('specialist', v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {props.specialists.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Data início</Label>
            <Input type="date" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data fim</Label>
            <Input type="date" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cliente Fit</Label>
            <Select value={props.filters.fitFilter ?? '__all__'} onValueChange={(v) => updateFilter('fit', v)}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="true">Somente Fit</SelectItem>
                <SelectItem value="false">Somente Não Fit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Period shortcuts */}
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
          <Label className="text-xs text-muted-foreground mr-1 self-center">Período:</Label>
          {[
            { label: 'Hoje', days: 0 },
            { label: '7 dias', days: 7 },
            { label: '30 dias', days: 30 },
            { label: '90 dias', days: 90 },
            { label: 'Este mês', days: -1 },
            { label: 'Tudo', days: -2 },
          ].map(({ label, days }) => {
            const isActive = (() => {
              if (days === -2) return !startLocal && !endLocal
              const today = new Date().toISOString().substring(0, 10)
              if (days === 0) return startLocal === today && endLocal === today
              if (days === -1) {
                const first = new Date(); first.setDate(1)
                return startLocal === first.toISOString().substring(0, 10) && endLocal === today
              }
              const from = new Date(); from.setDate(from.getDate() - days)
              return startLocal === from.toISOString().substring(0, 10) && endLocal === today
            })()
            return (
              <button
                key={label}
                onClick={() => {
                  const today = new Date().toISOString().substring(0, 10)
                  if (days === -2) { setStartLocal(''); setEndLocal(''); return }
                  if (days === 0) { setStartLocal(today); setEndLocal(today); return }
                  if (days === -1) {
                    const first = new Date(); first.setDate(1)
                    setStartLocal(first.toISOString().substring(0, 10)); setEndLocal(today); return
                  }
                  const from = new Date(); from.setDate(from.getDate() - days)
                  setStartLocal(from.toISOString().substring(0, 10)); setEndLocal(today)
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* ═══ FILTROS AVANÇADOS ═══ */}
      <MenteeFilters
        filters={localAdvFilters}
        onFilterChange={handleAdvFilterChange}
        onClearAll={handleClearAdvFilters}
        options={props.filterOptions}
      />

      {/* ═══ VISÃO GERAL DOS MENTORADOS ═══ */}
      <section className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
          <Users className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Visão geral dos mentorados</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MetricCard icon={Users} label="Mentorados ativos" value={props.section2.totalMentees} color="text-accent" bg="bg-accent/10" source="mentees (status=ativo)" />
            <MetricCard icon={Star} label="Clientes Fit" value={props.section2.fitMentees} color="text-warning" bg="bg-warning/10" source="mentees (cliente_fit)" />
            <MetricCard icon={UserPlus} label="Indicações geradas" value={props.section2.totalIndications} color="text-success" bg="bg-success/10" source="indications" />
          </div>
        </div>
      </section>

      {/* ═══ SUCESSO DO CLIENTE ═══ */}
      <section className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-success/5 to-transparent">
          <TrendingUp className="h-4 w-4 text-success" />
          <h2 className="text-sm font-semibold text-foreground">Sucesso do cliente</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard icon={TrendingUp} label="Crescimento faturamento" value={props.section3.growthPct !== 0 ? `${props.section3.growthPct > 0 ? '+' : ''}${props.section3.growthPct}%` : '—'} color={props.section3.growthPct > 0 ? 'text-success' : 'text-destructive'} bg={props.section3.growthPct > 0 ? 'bg-success/10' : 'bg-destructive/10'} source={`${props.section3.growthCount}/${props.section3.growthTotal} cresceram`} />
            <MetricCard icon={DollarSign} label="Faturamento total (Bethel Metrics)" value={formatBRL(props.section3.totalFaturamentoAtual)} color="text-success" bg="bg-success/10" source="soma faturamento_atual mentorados ativos" />
            <MetricCard icon={TrendingUp} label="Avanço nas etapas" value={`${props.section3.menteesAdvanced} mentorados`} color="text-info" bg="bg-info/10" source="mentorados distintos que avançaram" />
            <MetricCard icon={MessageSquareQuote} label="Nº de depoimentos" value={props.section3.totalTestimonials} color="text-warning" bg="bg-warning/10" source="testimonials" note={props.section3.totalMentees > 0 ? `${Math.round((props.section3.totalTestimonials / props.section3.totalMentees) * 100)}% dos mentorados` : ''} />
            <MetricCard icon={Users} label="Mentorados com depoimento" value={props.section3.menteesWithTestimonial} color="text-warning" bg="bg-warning/10" source="mentorados distintos com depoimento" note={props.section3.totalMentees > 0 ? `${Math.round((props.section3.menteesWithTestimonial / props.section3.totalMentees) * 100)}% dos mentorados` : ''} />
          </div>
        </div>
      </section>

      {/* ═══ ENGAJAMENTO ═══ */}
      <section className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-info/5 to-transparent">
          <BookOpen className="h-4 w-4 text-info" />
          <h2 className="text-sm font-semibold text-foreground">Engajamento</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[
              { key: 'hotseat', label: 'Hotseat' },
              { key: 'comercial', label: 'Comercial' },
              { key: 'gestao', label: 'Gestão' },
              { key: 'mkt', label: 'Mkt' },
              { key: 'extras', label: 'Entregas Extras' },
              { key: 'mentoria_individual', label: 'Mentoria Individual' },
            ].map(({ key, label }) => {
              const stat = props.engajamento.deliveryStats[key] ?? { delivered: 0, participated: 0 }
              const rate = stat.delivered > 0 ? Math.round((stat.participated / stat.delivered) * 100) : 0
              return (
                <MetricCard
                  key={key}
                  icon={CalendarCheck}
                  label={label}
                  value={`${stat.participated}/${stat.delivered}`}
                  color="text-info"
                  bg="bg-info/10"
                  source={`${rate}% taxa de participação`}
                  note={`Entregues: ${stat.delivered} · Participou: ${stat.participated}`}
                />
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 mt-3">
            <MetricCard icon={CalendarCheck} label="Eventos" value={props.engajamento.eventos} color="text-warning" bg="bg-warning/10" source="engagement_records (evento)" />
            <MetricCard icon={Video} label="Participação Intensivo" value={props.engajamento.intensivo} color="text-accent" bg="bg-accent/10" source="engagement_records (live)" />
            <MetricCard icon={Star} label="Encontro Elite Premium" value={props.engajamento.encontro} color="text-success" bg="bg-success/10" source="engagement_records" />
          </div>
        </div>
      </section>

      {/* ═══ TRABALHO DO CS ═══ */}
      <section className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-warning/5 to-transparent">
          <Phone className="h-4 w-4 text-warning" />
          <h2 className="text-sm font-semibold text-foreground">Trabalho do CS</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MetricCard icon={Headphones} label="Total de atendimentos" value={props.section4.totalAtendimentos} color="text-accent" bg="bg-accent/10" source="sessões de chat (gap configurável)" note={`Mentorado: ${props.section4.atendimentosMentee} · CS: ${props.section4.atendimentosCS}`} />
            <MetricCard icon={Headphones} label="Tempo de espera" value={props.section4.avgWaitMinutes > 0 ? formatMinutes(props.section4.avgWaitMinutes) : '—'} color="text-warning" bg="bg-warning/10" source="tempo médio até CS responder" />
            <MetricCard icon={Headphones} label="Tempo médio de atendimento" value={props.section4.avgManualAttendanceMinutes > 0 ? `${props.section4.avgManualAttendanceMinutes} min` : '—'} color="text-accent" bg="bg-accent/10" source="botão iniciar/finalizar no chat" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mt-3">
            <MetricCard icon={Phone} label="Ligações realizadas" value={props.section4.totalLigacoes} color="text-warning" bg="bg-warning/10" source="call_records" />
            <MetricCard icon={Phone} label="Tempo de ligações" value={formatMinutes(props.section4.totalLigacaoDuration)} color="text-warning" bg="bg-warning/10" source="call_records (duration)" />
            <MetricCard icon={MessageCircle} label="Mensagens enviadas" value={props.section4.totalWhatsapp} color="text-success" bg="bg-success/10" source="wpp_messages (outgoing)" />
            <MetricCard icon={MessageCircle} label="Mensagens recebidas" value={props.section4.totalWhatsappIn} color="text-info" bg="bg-info/10" source="wpp_messages (incoming)" />
          </div>
        </div>
      </section>

      {/* ═══ LTV DOS MENTORADOS ═══ */}
      <section className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
          <DollarSign className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">LTV dos Mentorados</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard icon={DollarSign} label="Crossell" value={formatBRL(props.section5.crossell)} color="text-success" bg="bg-success/10" source="revenue_records (crossell)" />
            <MetricCard icon={TrendingUp} label="Ascensão" value={formatBRL(props.section5.upsell)} color="text-accent" bg="bg-accent/10" source="revenue_records (upsell)" />
            <MetricCard icon={UserPlus} label="Indicação que fechou" value={formatBRL(props.section5.indicacao_perpetuo)} color="text-info" bg="bg-info/10" source="revenue_records (indic_perpetuo)" />
            <MetricCard icon={UserPlus} label="Indicação intensivo que fechou" value={formatBRL(props.section5.indicacao_intensivo)} color="text-warning" bg="bg-warning/10" source="revenue_records (indic_intensivo)" />
            <MetricCard icon={DollarSign} label="Total geral" value={formatBRL(props.section5.total)} color="text-foreground" bg="bg-muted" source="revenue_records (soma)" highlight />
          </div>
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  note,
  highlight,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
  bg: string
  source?: string
  note?: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 sm:p-4 min-h-[88px] ${highlight ? 'border-accent/20 bg-accent/5' : 'border-border bg-background'}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <div className={`rounded-md p-1.5 sm:p-2 ${bg} shrink-0`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wide leading-tight">{label}</p>
          <p className={`font-heading text-base sm:text-lg font-bold tabular leading-tight mt-0.5 ${highlight ? 'text-accent' : 'text-foreground'}`}>{value}</p>
          {note && <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>
    </div>
  )
}
