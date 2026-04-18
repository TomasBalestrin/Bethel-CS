import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Activity, MessageSquare, Wifi } from 'lucide-react'

export interface HealthStats {
  errors24h: number
  lastErrorAt: string | null
  lastIncomingAt: string | null
  connectedInstances: number
  totalInstances: number
}

function formatAgo(iso: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

// Severidade global: vermelho se erro crítico ou apagão de WhatsApp;
// amarelo se houve qualquer erro nas últimas 24h ou webhook parado >1h;
// verde caso contrário.
function classify(stats: HealthStats): 'green' | 'yellow' | 'red' {
  if (stats.connectedInstances === 0 && stats.totalInstances > 0) return 'red'
  if (stats.errors24h >= 10) return 'red'
  if (stats.errors24h > 0) return 'yellow'
  if (stats.lastIncomingAt) {
    const minSinceLast = (Date.now() - new Date(stats.lastIncomingAt).getTime()) / 60000
    if (minSinceLast > 60) return 'yellow'
  }
  return 'green'
}

export function AdminHealthWidget({ stats }: { stats: HealthStats }) {
  const severity = classify(stats)
  const color = severity === 'red' ? 'destructive' : severity === 'yellow' ? 'warning' : 'success'
  const Icon = severity === 'green' ? CheckCircle2 : AlertTriangle
  const headline = severity === 'red'
    ? 'Atenção — falhas críticas'
    : severity === 'yellow'
      ? 'Alguns alertas nas últimas 24h'
      : 'Sistema saudável'

  return (
    <div className={`rounded-lg border p-4 border-${color}/30 bg-${color}/5`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2 bg-${color}/10 shrink-0`}>
          <Icon className={`h-4 w-4 text-${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold text-${color}`}>{headline}</h3>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
            <Stat
              icon={Activity}
              label="Erros 24h"
              value={String(stats.errors24h)}
              hint={stats.lastErrorAt ? `última ${formatAgo(stats.lastErrorAt)}` : ''}
              emphasis={stats.errors24h > 0}
            />
            <Stat
              icon={MessageSquare}
              label="Última msg recebida"
              value={formatAgo(stats.lastIncomingAt)}
              hint=""
              emphasis={!!stats.lastIncomingAt && (Date.now() - new Date(stats.lastIncomingAt).getTime()) / 60000 > 60}
            />
            <Stat
              icon={Wifi}
              label="WhatsApp"
              value={`${stats.connectedInstances}/${stats.totalInstances}`}
              hint="conectadas"
              emphasis={stats.connectedInstances === 0 && stats.totalInstances > 0}
            />
            <Link
              href="/admin/erros-sync"
              className="rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-[11px] hover:bg-muted/40 flex items-center justify-center text-center"
            >
              Ver erros →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, hint, emphasis }: {
  icon: typeof Activity
  label: string
  value: string
  hint: string
  emphasis: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${emphasis ? 'text-destructive' : 'text-muted-foreground'}`} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-sm font-bold tabular ${emphasis ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}
