'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
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
} from 'lucide-react'

const PRIORITY_VARIANT: Record<number, 'muted' | 'warning' | 'info' | 'success' | 'accent'> = {
  1: 'muted', 2: 'warning', 3: 'info', 4: 'success', 5: 'accent',
}

interface DashboardMetricsProps {
  userName: string
  specialists: { id: string; full_name: string }[]
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
    priorityDistribution: Record<number, number>
  }
  section3: {
    totalRevenue: number
    engByType: Record<string, number>
    totalTestimonials: number
    cancelados: number
  }
  section4: {
    totalLigacoes: number
    totalLigacaoDuration: number
    totalWhatsapp: number
    avgWhatsappDuration: number
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

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== '__all__') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Bem-vindo, {props.userName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Painel do Customer Success</p>
      </div>

      {/* ═══ SEÇÃO 1: FILTROS GLOBAIS ═══ */}
      <section className="rounded-lg border border-border bg-card p-4 shadow-card">
        <p className="label-xs mb-3">Filtros</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
          <div className="space-y-1">
            <Label className="text-xs">Data início</Label>
            <Input type="date" value={props.filters.startDate ?? ''} onChange={(e) => updateFilter('start', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data fim</Label>
            <Input type="date" value={props.filters.endDate ?? ''} onChange={(e) => updateFilter('end', e.target.value)} />
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
      </section>

      {/* ═══ SEÇÃO 2: VISÃO GERAL DOS MENTORADOS ═══ */}
      <section>
        <SectionTitle>Visão geral dos mentorados</SectionTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Users} label="Mentorados ativos" value={props.section2.totalMentees} color="text-accent" bg="bg-accent/10" />
          <MetricCard icon={Star} label="Clientes Fit" value={props.section2.fitMentees} color="text-warning" bg="bg-warning/10" />
          <MetricCard icon={UserPlus} label="Indicações geradas" value={props.section2.totalIndications} color="text-success" bg="bg-success/10" />
          <MetricCard icon={XCircle} label="Cancelamentos" value={props.section2.cancelados} color="text-destructive" bg="bg-destructive/10" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {[1, 2, 3, 4, 5].map((level) => (
            <div key={level} className="rounded-lg border border-border bg-card p-3 shadow-card text-center">
              <Badge variant={PRIORITY_VARIANT[level]}>Nível {level}</Badge>
              <p className="mt-1 font-heading text-xl font-bold text-foreground tabular">{props.section2.priorityDistribution[level] ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">mentorados</p>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* ═══ SEÇÃO 3: INDICADORES DE SUCESSO DO CLIENTE ═══ */}
      <section>
        <SectionTitle>Sucesso do cliente</SectionTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1 */}
          <MetricCard icon={DollarSign} label="Receita nova gerada" value={formatBRL(props.section3.totalRevenue)} color="text-success" bg="bg-success/10" />
          {/* Card 2 */}
          <MetricCard icon={TrendingUp} label="Avanço nas etapas" value="—" color="text-info" bg="bg-info/10" note="Log de stage changes pendente" />
          {/* Card 3 */}
          <MetricCard icon={BookOpen} label="Área de membros (Mentorfy)" value={`${props.section3.engByType.aula ?? 0} acessos registrados`} color="text-accent" bg="bg-accent/10" note="Registro manual — integração Mentorfy pendente" />
          {/* Card 4 */}
          <MetricCard icon={Video} label="Mentorias ao vivo" value={`${props.section3.engByType.live ?? 0} presenças registradas`} color="text-info" bg="bg-info/10" />
          {/* Card 5 */}
          <MetricCard icon={CalendarCheck} label="Eventos" value={`${props.section3.engByType.evento ?? 0} participações registradas`} color="text-warning" bg="bg-warning/10" />
          {/* Card 6 */}
          <MetricCard icon={Headphones} label="Canal do especialista" value={`${props.section3.engByType.whatsapp_contato ?? 0} contatos recebidos`} color="text-success" bg="bg-success/10" note="Será substituído por Stream Chat — Fase 9" />
          {/* Card 7 */}
          <MetricCard icon={MessageSquareQuote} label="Depoimentos gerados" value={props.section3.totalTestimonials} color="text-warning" bg="bg-warning/10" />
          {/* Card 8 */}
          <MetricCard icon={XCircle} label="Cancelamentos" value={props.section3.cancelados} color="text-destructive" bg="bg-destructive/10" />
        </div>
      </section>

      <Separator />

      {/* ═══ SEÇÃO 4: TRABALHO DO CS ═══ */}
      <section>
        <SectionTitle>Trabalho do CS</SectionTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Phone} label="Ligações realizadas" value={props.section4.totalLigacoes} color="text-warning" bg="bg-warning/10" />
          <MetricCard icon={Phone} label="Tempo total de ligações" value={formatMinutes(props.section4.totalLigacaoDuration)} color="text-warning" bg="bg-warning/10" />
          <MetricCard icon={MessageCircle} label="Atendimentos WhatsApp" value={props.section4.totalWhatsapp} color="text-success" bg="bg-success/10" />
          <MetricCard icon={MessageCircle} label="Tempo médio WhatsApp" value={props.section4.avgWhatsappDuration > 0 ? `${props.section4.avgWhatsappDuration} min` : '—'} color="text-success" bg="bg-success/10" />
        </div>
      </section>

      <Separator />

      {/* ═══ SEÇÃO 5: INDICADORES DE RECEITA NOVA ═══ */}
      <section>
        <SectionTitle>Receita nova</SectionTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard icon={DollarSign} label="Crossell" value={formatBRL(props.section5.crossell)} color="text-success" bg="bg-success/10" />
          <MetricCard icon={TrendingUp} label="Ascensão (Upsell)" value={formatBRL(props.section5.upsell)} color="text-accent" bg="bg-accent/10" />
          <MetricCard icon={UserPlus} label="Indicação Perpétuo" value={formatBRL(props.section5.indicacao_perpetuo)} color="text-info" bg="bg-info/10" />
          <MetricCard icon={UserPlus} label="Indicação Intensivo" value={formatBRL(props.section5.indicacao_intensivo)} color="text-warning" bg="bg-warning/10" />
          <MetricCard icon={UserPlus} label="Indicação Encontro Elite" value={formatBRL(props.section5.indicacao_encontro)} color="text-accent" bg="bg-accent/10" />
          <MetricCard icon={DollarSign} label="Total geral receita nova" value={formatBRL(props.section5.total)} color="text-foreground" bg="bg-muted" />
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-xl font-semibold text-foreground">{children}</h2>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  note,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
  bg: string
  note?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card animate-slide-up">
      <div className="flex items-center gap-3">
        <div className={`rounded-md p-2 ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div className="min-w-0">
          <p className="label-xs">{label}</p>
          <p className="font-heading text-lg font-bold text-foreground tabular leading-tight">{value}</p>
          {note && <p className="mt-0.5 text-[10px] text-muted-foreground">{note}</p>}
        </div>
      </div>
    </div>
  )
}
