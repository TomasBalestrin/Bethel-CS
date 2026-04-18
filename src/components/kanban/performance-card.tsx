'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, RefreshCw, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// Performance card do mentorado — consome /api/metrics/:menteeId. Faz 1 fetch
// ao montar (com TTL 24h no backend, então normalmente é cache hit) e oferece
// botão "Atualizar" pra forçar refresh a qualquer momento.
//
// Props: dados "seed" que o servidor já conhece (vindos de mentees.*). Quando
// a chamada à rota retorna dados atualizados, sobrescreve o seed no state.

interface Metrics {
  faturamento_atual: number | null
  faturamento_mes_anterior: number | null
  faturamento_antes_mentoria: number | null
  ultimo_acesso: string | null
  dias_acessou_sistema: number | null
  dias_preencheu: number | null
  total_leads: number | null
  total_vendas: number | null
  total_receita_periodo: number | null
  total_entrada_periodo: number | null
  taxa_conversao: number | null
  ticket_medio: number | null
  funis_ativos: Array<{ id?: string; nome: string; slug?: string }>
}

function formatBRL(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function hasAnyMetric(m: Metrics): boolean {
  return (
    m.faturamento_atual != null ||
    m.faturamento_mes_anterior != null ||
    m.total_leads != null ||
    m.total_vendas != null ||
    (m.funis_ativos && m.funis_ativos.length > 0)
  )
}

export function PerformanceCard({ menteeId, seed, seedUpdatedAt, seedSourceUpdatedAt, onStateChange }: {
  menteeId: string
  seed: Metrics
  seedUpdatedAt: string | null
  seedSourceUpdatedAt?: string | null
  // Notifica o pai sempre que o estado sync/source mudar, pra o BmBadge no
  // painel (fora do card) refletir em tempo real.
  onStateChange?: (s: { sourceUpdatedAt: string | null; syncing: boolean }) => void
}) {
  const [metrics, setMetrics] = useState<Metrics>(seed)
  const [updatedAt, setUpdatedAt] = useState<string | null>(seedUpdatedAt)
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState<string | null>(seedSourceUpdatedAt ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [notFound, setNotFound] = useState(false)

  // Notifica o pai do estado atual. Roda a cada render do Badge.
  useEffect(() => {
    onStateChange?.({ sourceUpdatedAt, syncing: refreshing })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUpdatedAt, refreshing])

  async function load(force: boolean) {
    if (refreshing) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/metrics/${menteeId}${force ? '?force=true' : ''}`)
      if (!res.ok) {
        if (force) toast.error('Erro ao atualizar métricas')
        return
      }
      const data = await res.json() as { metrics: Metrics; updatedAt: string | null; sourceUpdatedAt: string | null; notFound?: boolean }
      setMetrics(data.metrics)
      setUpdatedAt(data.updatedAt)
      setSourceUpdatedAt(data.sourceUpdatedAt ?? null)
      setNotFound(!!data.notFound)
      if (force) {
        toast.success(data.notFound ? 'Mentorado não encontrado no Bethel Metrics' : 'Métricas atualizadas')
      }
    } catch (err) {
      if (force) toast.error('Erro ao atualizar: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setRefreshing(false)
    }
  }

  // Fetch automático ao montar — backend respeita TTL 24h e retorna cache
  // quase sempre. Se cache miss, faz o pull uma vez por dia.
  useEffect(() => {
    load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menteeId])

  const has = hasAnyMetric(metrics)

  if (!has && notFound) {
    return (
      <div id="bm-performance-card" className="rounded-lg border border-dashed border-border/50 bg-muted/5 px-3 py-2.5 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        <p className="text-[11px] text-muted-foreground/60 flex-1">
          Mentorado não encontrado no Bethel Metrics
        </p>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-[11px] text-accent hover:underline disabled:opacity-50"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!has) {
    return (
      <div id="bm-performance-card" className="rounded-lg border border-dashed border-border/50 bg-muted/5 px-3 py-2.5 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground/20 shrink-0" />
        <p className="text-[11px] text-muted-foreground/40 flex-1">
          {refreshing ? 'Buscando métricas…' : 'Métricas via Bethel Metrics'}
        </p>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-[11px] text-accent hover:underline disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>
    )
  }

  return (
    <div id="bm-performance-card" className="rounded-lg border border-border bg-card shadow-card overflow-hidden scroll-mt-4">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-accent" />
          <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Performance</h3>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(updatedAt).toLocaleDateString('pt-BR')}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-accent disabled:opacity-50"
            title="Atualizar agora"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '' : 'Atualizar'}
          </button>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <Box label="Fat. atual" value={metrics.faturamento_atual != null ? formatBRL(metrics.faturamento_atual) : '—'} highlight />
          <Box label="Mês anterior" value={metrics.faturamento_mes_anterior != null ? formatBRL(metrics.faturamento_mes_anterior) : '—'} />
          <Box label="Antes mentoria" value={metrics.faturamento_antes_mentoria != null ? formatBRL(metrics.faturamento_antes_mentoria) : '—'} />
          <Box label="Ticket médio" value={metrics.ticket_medio != null ? formatBRL(metrics.ticket_medio) : '—'} />
          <Box label="Leads" value={metrics.total_leads ?? '—'} />
          <Box label="Vendas" value={metrics.total_vendas ?? '—'} />
          <Box label="Conversão" value={metrics.taxa_conversao != null ? `${metrics.taxa_conversao}%` : '—'} />
          <Box label="Dias acessou" value={metrics.dias_acessou_sistema ?? '—'} />
        </div>
        {metrics.funis_ativos && metrics.funis_ativos.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Funis ativos</p>
            <div className="flex flex-wrap gap-1">
              {metrics.funis_ativos.map((f, i) => (
                <Badge key={f.id ?? i} variant="muted" className="text-[10px]">{f.nome}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Box({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${highlight ? 'border-accent/30 bg-accent/5' : 'border-border bg-background'}`}>
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold tabular ${highlight ? 'text-accent' : 'text-foreground'}`}>{value}</p>
    </div>
  )
}
