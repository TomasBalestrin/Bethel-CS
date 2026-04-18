// Classifica o estado do dado do Bethel Metrics para um mentorado.
// Usado pelo badge visual (BM) no card do Kanban e no painel do mentorado.

export type BmStatus = 'fresh' | 'stale' | 'outdated' | 'unlinked' | 'syncing'

export interface BmStatusInfo {
  status: BmStatus
  days: number | null
  label: string
  colorClass: string
  dotClass: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const STALE_AFTER_DAYS = 7
const OUTDATED_AFTER_DAYS = 30

// Recebe o `metrics_source_updated_at` — timestamp de quando o BM teve
// atividade real nesse mentorado. `null` significa que o mentorado nunca foi
// encontrado no BM (email/phone não bate).
//
// Também aceita um `syncing: true` pra estado transitório enquanto a rota
// `/api/metrics/:id?force=true` está rodando.
export function classifyBm(
  sourceUpdatedAt: string | null | undefined,
  opts?: { syncing?: boolean }
): BmStatusInfo {
  if (opts?.syncing) {
    return {
      status: 'syncing',
      days: null,
      label: 'Bethel Metrics sincronizando…',
      colorClass: 'text-muted-foreground',
      dotClass: 'bg-muted-foreground/40 animate-pulse',
    }
  }

  if (!sourceUpdatedAt) {
    return {
      status: 'unlinked',
      days: null,
      label: 'Bethel Metrics não conectado',
      colorClass: 'text-muted-foreground',
      // círculo oco, indica "não mapeado" — diferente de "dado velho"
      dotClass: 'bg-transparent border border-muted-foreground/40',
    }
  }

  const days = Math.floor((Date.now() - new Date(sourceUpdatedAt).getTime()) / DAY_MS)
  if (days < STALE_AFTER_DAYS) {
    return {
      status: 'fresh',
      days,
      label: days <= 0 ? 'Bethel Metrics atualizado hoje' : `Bethel Metrics atualizado há ${days}d`,
      colorClass: 'text-success',
      dotClass: 'bg-success',
    }
  }
  if (days < OUTDATED_AFTER_DAYS) {
    return {
      status: 'stale',
      days,
      label: `Bethel Metrics não atualizado há ${days}d`,
      colorClass: 'text-muted-foreground',
      dotClass: 'bg-muted-foreground/60',
    }
  }
  return {
    status: 'outdated',
    days,
    label: `Bethel Metrics não atualizado há ${days}d`,
    colorClass: 'text-destructive',
    dotClass: 'bg-destructive',
  }
}
