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
  XCircle,
  Star,
  BookOpen,
  Video,
  CalendarCheck,
  Headphones,
  Database,
  FileText,
} from 'lucide-react'

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
  section2: {
    totalMentees: number
    fitMentees: number
    totalIndications: number
    cancelados: number
  }
  section3: {
    totalRevenue: number
    engByType: Record<string, number>
    totalTestimonials: number
    cancelados: number
    totalStageChanges: number
    avgGrowth: number
    growthCount: number
    growthTotal: number
  }
  section4: {
    totalLigacoes: number
    totalLigacaoDuration: number
    totalWhatsapp: number
    totalWhatsappIn: number
    avgWhatsappDuration: number
    totalAtendimentos: number
    totalAttendanceMinutes: number
    avgAttendanceMinutes: number
  }
  section5: {
    crossell: number
    upsell: number
    indicacao_perpetuo: number
    indicacao_intensivo: number
    indicacao_encontro: number
    total: number
  }
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

  return (
    <div className="space-y-6">
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

      {/* ═══ VISÃO GERAL DOS MENTORADOS ═══ */}
      <section className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
          <Users className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Visão geral dos mentorados</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard icon={Users} label="Mentorados ativos" value={props.section2.totalMentees} color="text-accent" bg="bg-accent/10" source="mentees (status=ativo)" />
            <MetricCard icon={Star} label="Clientes Fit" value={props.section2.fitMentees} color="text-warning" bg="bg-warning/10" source="mentees (cliente_fit)" />
            <MetricCard icon={UserPlus} label="Indicações geradas" value={props.section2.totalIndications} color="text-success" bg="bg-success/10" source="indications" />
            <MetricCard icon={XCircle} label="Cancelamentos" value={props.section2.cancelados} color="text-destructive" bg="bg-destructive/10" source="mentees (status=cancelado)" />
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MetricCard icon={TrendingUp} label="Crescimento faturamento" value={props.section3.avgGrowth !== 0 ? `${props.section3.avgGrowth > 0 ? '+' : ''}${props.section3.avgGrowth}%` : '—'} color={props.section3.avgGrowth > 0 ? 'text-success' : 'text-destructive'} bg={props.section3.avgGrowth > 0 ? 'bg-success/10' : 'bg-destructive/10'} source={`${props.section3.growthCount}/${props.section3.growthTotal} cresceram`} />
            <MetricCard icon={DollarSign} label="Receita nova gerada" value={formatBRL(props.section3.totalRevenue)} color="text-success" bg="bg-success/10" source="revenue_records" />
            <MetricCard icon={TrendingUp} label="Avanço nas etapas" value={`${props.section3.totalStageChanges} movimentações`} color="text-info" bg="bg-info/10" source="stage_changes" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 mt-3">
            <MetricCard icon={BookOpen} label="Área de membros" value={`${props.section3.engByType.aula ?? 0} acessos`} color="text-accent" bg="bg-accent/10" source="engagement_records (aula)" />
            <MetricCard icon={Video} label="Mentorias ao vivo" value={`${props.section3.engByType.live ?? 0} presenças`} color="text-info" bg="bg-info/10" source="engagement_records (live)" />
            <MetricCard icon={CalendarCheck} label="Eventos" value={`${props.section3.engByType.evento ?? 0} participações`} color="text-warning" bg="bg-warning/10" source="engagement_records (evento)" />
            <MetricCard icon={Headphones} label="Canal do especialista" value={`${props.section3.engByType.whatsapp_contato ?? 0} contatos`} color="text-success" bg="bg-success/10" source="engagement_records (whatsapp)" />
            <MetricCard icon={MessageSquareQuote} label="Depoimentos" value={props.section3.totalTestimonials} color="text-warning" bg="bg-warning/10" source="testimonials" />
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard icon={Headphones} label="Atendimentos" value={props.section4.totalAtendimentos} color="text-accent" bg="bg-accent/10" source="sessões de chat (gap configurável)" />
            <MetricCard icon={Headphones} label="Tempo total atendimento" value={formatMinutes(props.section4.totalAttendanceMinutes)} color="text-accent" bg="bg-accent/10" source="duração das sessões de chat" />
            <MetricCard icon={Headphones} label="Média por atendimento" value={props.section4.avgAttendanceMinutes > 0 ? `${props.section4.avgAttendanceMinutes} min` : '—'} color="text-accent" bg="bg-accent/10" source="duração média por sessão" />
            <MetricCard icon={Phone} label="Ligações realizadas" value={props.section4.totalLigacoes} color="text-warning" bg="bg-warning/10" source="call_records" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mt-3">
            <MetricCard icon={Phone} label="Tempo de ligações" value={formatMinutes(props.section4.totalLigacaoDuration)} color="text-warning" bg="bg-warning/10" source="call_records (duration)" />
            <MetricCard icon={MessageCircle} label="Mensagens enviadas" value={props.section4.totalWhatsapp} color="text-success" bg="bg-success/10" source="wpp_messages (outgoing)" />
            <MetricCard icon={MessageCircle} label="Mensagens recebidas" value={props.section4.totalWhatsappIn} color="text-info" bg="bg-info/10" source="wpp_messages (incoming)" />
            <MetricCard icon={MessageCircle} label="Tempo médio WhatsApp" value={props.section4.avgWhatsappDuration > 0 ? `${props.section4.avgWhatsappDuration} min` : '—'} color="text-success" bg="bg-success/10" source="cs_activities (manual)" />
          </div>
        </div>
      </section>

      {/* ═══ RECEITA NOVA ═══ */}
      <section className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
          <DollarSign className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Receita nova</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MetricCard icon={DollarSign} label="Crossell" value={formatBRL(props.section5.crossell)} color="text-success" bg="bg-success/10" source="revenue_records (crossell)" />
            <MetricCard icon={TrendingUp} label="Ascensão (Upsell)" value={formatBRL(props.section5.upsell)} color="text-accent" bg="bg-accent/10" source="revenue_records (upsell)" />
            <MetricCard icon={UserPlus} label="Indicação Perpétuo" value={formatBRL(props.section5.indicacao_perpetuo)} color="text-info" bg="bg-info/10" source="revenue_records (indic_perpetuo)" />
            <MetricCard icon={UserPlus} label="Indicação Intensivo" value={formatBRL(props.section5.indicacao_intensivo)} color="text-warning" bg="bg-warning/10" source="revenue_records (indic_intensivo)" />
            <MetricCard icon={UserPlus} label="Indicação Encontro" value={formatBRL(props.section5.indicacao_encontro)} color="text-accent" bg="bg-accent/10" source="revenue_records (indic_encontro)" />
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
  source,
  note,
  highlight,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
  bg: string
  source: string
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
          {note && <p className="mt-0.5 text-[9px] text-muted-foreground/70 italic">{note}</p>}
          <p className="mt-1 text-[8px] text-muted-foreground/40 flex items-center gap-0.5">
            <FileText className="h-2 w-2" /> {source}
          </p>
        </div>
      </div>
    </div>
  )
}
