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
} from 'lucide-react'

const PRIORITY_VARIANT: Record<number, 'muted' | 'warning' | 'info' | 'success' | 'accent'> = {
  1: 'muted',
  2: 'warning',
  3: 'info',
  4: 'success',
  5: 'accent',
}

const ENGAGEMENT_LABELS: Record<string, string> = {
  area_membros: 'Área de Membros',
  mentoria_ao_vivo: 'Mentoria ao Vivo',
  evento: 'Evento',
  canal_especialista: 'Canal do Especialista',
}

interface DashboardMetricsProps {
  userName: string
  specialists: { id: string; full_name: string }[]
  filters: {
    specialistId: string | null
    startDate: string | null
    endDate: string | null
    fitOnly: boolean
  }
  totalMentees: number
  fitMentees: number
  priorityDistribution: Record<number, number>
  totalRevenue: number
  crossellTotal: number
  upsellTotal: number
  totalTestimonials: number
  totalCancellations: number
  totalIndications: number
  engagementByType: Record<string, { count: number; total: number }>
  avgResponseTime: number
  totalLigacoes: number
  totalLigacaoDuration: number
  totalWhatsapp: number
  totalWhatsappDuration: number
  avgWhatsappDuration: number
}

function formatBRL(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
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
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral do Customer Success
        </p>
      </div>

      {/* ─── Filters ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <Label className="label-xs">Especialista</Label>
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
          <Label className="label-xs">Data início</Label>
          <Input
            type="date"
            value={props.filters.startDate ?? ''}
            onChange={(e) => updateFilter('start', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="label-xs">Data fim</Label>
          <Input
            type="date"
            value={props.filters.endDate ?? ''}
            onChange={(e) => updateFilter('end', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="label-xs">Cliente Fit</Label>
          <Select value={props.filters.fitOnly ? 'true' : '__all__'} onValueChange={(v) => updateFilter('fit', v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="true">Apenas Fit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── SEÇÃO 1: Visão Geral ─── */}
      <section>
        <SectionHeader icon={Users} title="Visão Geral dos Mentorados" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Users} label="Mentorados Ativos" value={props.totalMentees} color="text-accent" bg="bg-accent/10" />
          <MetricCard icon={Star} label="Clientes Fit" value={props.fitMentees} color="text-warning" bg="bg-warning/10" />
          <MetricCard icon={UserPlus} label="Indicações" value={props.totalIndications} color="text-success" bg="bg-success/10" />
          <MetricCard icon={XCircle} label="Cancelamentos" value={props.totalCancellations} color="text-destructive" bg="bg-destructive/10" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {[1, 2, 3, 4, 5].map((level) => (
            <div key={level} className="rounded-lg border border-border bg-card p-3 shadow-card text-center animate-fade-in">
              <Badge variant={PRIORITY_VARIANT[level]}>Nível {level}</Badge>
              <p className="mt-1 font-heading text-xl font-bold text-foreground tabular">{props.priorityDistribution[level] ?? 0}</p>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* ─── SEÇÃO 2: Indicadores de Sucesso ─── */}
      <section>
        <SectionHeader icon={TrendingUp} title="Indicadores de Sucesso" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={DollarSign} label="Receita Nova Total" value={formatBRL(props.totalRevenue)} color="text-success" bg="bg-success/10" />
          <MetricCard icon={MessageSquareQuote} label="Depoimentos" value={props.totalTestimonials} color="text-warning" bg="bg-warning/10" />
          <MetricCard icon={MessageCircle} label="Tempo Médio Resposta" value={props.avgResponseTime > 0 ? `${props.avgResponseTime} min` : '—'} color="text-info" bg="bg-info/10" />
          <MetricCard icon={XCircle} label="Cancelamentos" value={props.totalCancellations} color="text-destructive" bg="bg-destructive/10" />
        </div>
        {/* Engagement breakdown */}
        {Object.keys(props.engagementByType).length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(props.engagementByType).map(([type, data]) => (
              <div key={type} className="rounded-lg border border-border bg-card p-3 shadow-card animate-fade-in">
                <p className="label-xs">{ENGAGEMENT_LABELS[type] ?? type}</p>
                <p className="font-heading text-lg font-bold text-foreground tabular">{data.count} registros</p>
                <p className="text-xs text-muted-foreground tabular">Total: {data.total}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* ─── SEÇÃO 3: Trabalho do CS ─── */}
      <section>
        <SectionHeader icon={Phone} title="Trabalho do CS" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Phone} label="Ligações" value={props.totalLigacoes} color="text-warning" bg="bg-warning/10" />
          <MetricCard icon={Phone} label="Tempo Total Ligações" value={formatMinutes(props.totalLigacaoDuration)} color="text-warning" bg="bg-warning/10" />
          <MetricCard icon={MessageCircle} label="Atendimentos WhatsApp" value={props.totalWhatsapp} color="text-success" bg="bg-success/10" />
          <MetricCard icon={MessageCircle} label="Tempo Médio WhatsApp" value={props.avgWhatsappDuration > 0 ? `${props.avgWhatsappDuration} min` : '—'} color="text-success" bg="bg-success/10" />
        </div>
      </section>

      <Separator />

      {/* ─── SEÇÃO 4: Indicadores de Receita ─── */}
      <section>
        <SectionHeader icon={DollarSign} title="Indicadores de Receita Nova" />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <MetricCard icon={DollarSign} label="Total Crossell" value={formatBRL(props.crossellTotal)} color="text-success" bg="bg-success/10" />
          <MetricCard icon={TrendingUp} label="Total Upsell (Ascensão)" value={formatBRL(props.upsellTotal)} color="text-accent" bg="bg-accent/10" />
          <MetricCard icon={DollarSign} label="Receita Total" value={formatBRL(props.totalRevenue)} color="text-info" bg="bg-info/10" />
        </div>
      </section>
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
  bg: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card animate-slide-up">
      <div className="flex items-center gap-3">
        <div className={`rounded-md p-2 ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="label-xs">{label}</p>
          <p className="font-heading text-xl font-bold text-foreground tabular">{value}</p>
        </div>
      </div>
    </div>
  )
}
