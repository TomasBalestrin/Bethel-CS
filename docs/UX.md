# Bethel CS — UX, Performance e Otimização

**Sistema:** Bethel CS (Customer Success para Mentoria Elite Premium)  
**Stack:** Next.js 14 | React 18 | Supabase | Tailwind CSS | Vercel  
**Data:** 02/04/2026  
**Versão:** 1.0

---

## 1. Visão Geral da Arquitetura de Performance

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAMADA CLIENT                            │
│  React Query (cache 60s) → Zustand (state) → Realtime (live)   │
├─────────────────────────────────────────────────────────────────┤
│                        CAMADA SERVER                            │
│  Server Components (SSR) → Promise.all (paralelo) → Streaming   │
├─────────────────────────────────────────────────────────────────┤
│                        CAMADA EDGE                              │
│  Edge Runtime (4 routes) → PWA Cache → CDN Vercel               │
├─────────────────────────────────────────────────────────────────┤
│                        CAMADA DADOS                             │
│  Supabase (select específico) → Realtime → RLS                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Os 20 Conceitos Aplicados

### 2.1 Perceived Performance (Sensação de velocidade)

**Princípio:** Nunca mostrar tela vazia. O usuário deve ver a forma do conteúdo em < 200ms.

**Implementação:** Next.js `loading.tsx` em todas as 7 rotas do dashboard. Quando o usuário navega, o skeleton aparece instantaneamente enquanto o server component busca os dados.

**Arquivos:**
- `src/app/(dashboard)/loading.tsx` — Dashboard (filtros + 3 seções de cards)
- `src/app/(dashboard)/etapas-iniciais/loading.tsx` — Kanban 4 colunas
- `src/app/(dashboard)/etapas-mentoria/loading.tsx` — Kanban 5 colunas
- `src/app/(dashboard)/mentorados/loading.tsx` — Grid 3 colunas de cards
- `src/app/(dashboard)/depoimentos/loading.tsx` — Grid de depoimentos
- `src/app/(dashboard)/objetivos/loading.tsx` — Lista de objetivos
- `src/app/(dashboard)/admin/loading.tsx` — Tabs + lista de usuários

---

### 2.2 Skeleton Loading

**Princípio:** Skeletons devem espelhar o layout final — mesmos grids, mesmas proporções.

**Implementação:** Componente `Skeleton` reutilizável com `animate-pulse`. Cada `loading.tsx` replica a estrutura exata da página com retângulos pulsantes.

**Arquivo:** `src/components/ui/skeleton.tsx`

```tsx
function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}
```

---

### 2.3 Optimistic UI

**Princípio:** Atualizar a interface ANTES do servidor confirmar. Reverter se falhar.

**Onde está aplicado:**
- **Kanban drag & drop** (`kanban-board.tsx:117-120`) — ao arrastar card, atualiza state local imediatamente. Se `moveMentee()` falhar, reverte para `previousMentees`
- **Chat messages** (`tab-chat.tsx:227-251`) — mensagem enviada aparece como "optimistic" com `id: temp-{timestamp}`. Se o `fetch` falhar, remove da lista
- **Unread counts** — marca como lido ao abrir, sem esperar resposta

---

### 2.4 Code Splitting / Lazy Loading

**Princípio:** Só carregar o que o usuário VÊ agora. Componentes atrás de tabs/modais = lazy.

**Implementação:**
- `AdminWebhooks` (1180 linhas) — `dynamic(() => import(...), { ssr: false })` no `admin-user-list.tsx`
- `TabChat` (727 linhas) — `dynamic(() => import('./tab-chat'), { ssr: false })` no `mentee-panel.tsx`
- `jsPDF` + `html2canvas` — `await import('jspdf')` inline no handler de export

**Impacto:** ~200KB removidos do bundle inicial do admin.

---

### 2.5 Image Optimization

**Princípio:** Usar `next/image` com dimensões definidas. Lazy loading por padrão.

**Implementação:**
- Todas as `<img>` substituídas por `<Image>` no chat e depoimentos
- `remotePatterns` configurado para Supabase e S3 (WhatsApp)
- `unoptimized` para URLs externas desconhecidas
- `resolveMediaUrl()` no chat para converter caminhos relativos legados

**Arquivo:** `next.config.mjs`
```js
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '**.supabase.co' },
    { protocol: 'https', hostname: '**.supabase.in' },
    { protocol: 'https', hostname: 'whatsapp-avatar.s3.sa-east-1.amazonaws.com' },
  ],
}
```

---

### 2.6 Debounce & Throttle

**Princípio:** Esperar o usuário terminar antes de agir. 300-500ms de delay.

**Implementação:**
- **Dashboard date filters** (`dashboard-metrics.tsx`) — 500ms debounce via `useEffect` + `setTimeout` antes de `router.push`
- **Mentorados search** (`mentorados-list.tsx`) — 300ms debounce via `useDebounce` hook

**Hook reutilizável:** `src/hooks/use-debounce.ts`
```tsx
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
```

---

### 2.7 Caching Strategy

**Princípio:** Mostrar cache velho enquanto busca novo (stale-while-revalidate).

**3 camadas de cache:**

| Camada | Tecnologia | Duração | Onde |
|---|---|---|---|
| Client | React Query `staleTime` | 60s | Navegação entre páginas |
| PWA | Service Worker `runtimeCaching` | Variável | Offline/revisitas |
| Server | `revalidatePath()` em server actions | Sob demanda | Após mutations |

**PWA Cache rules** (`next.config.mjs`):
- Assets estáticos → `CacheFirst` (7 dias)
- Google Fonts → `CacheFirst` (30 dias)
- Imagens → `CacheFirst` (7 dias, max 100)
- Dashboard/páginas → `StaleWhileRevalidate` (1 hora)
- API routes → `NetworkFirst` (sem cache)

**React Query:** `src/components/query-provider.tsx`
```tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,    // 60s — dados "frescos" por 1 minuto
      gcTime: 5 * 60 * 1000,   // 5min — garbage collect após 5min
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
```

---

### 2.8 Error Boundaries & Fallbacks

**Princípio:** Falhar com graça, nunca com tela branca.

**3 níveis de proteção:**

| Nível | Arquivo | Escopo |
|---|---|---|
| Páginas do dashboard | `src/app/(dashboard)/error.tsx` | Next.js native — botão "Tentar novamente" + "Voltar ao início" |
| Crítico/root | `src/app/global-error.tsx` | Erro no layout root — tem próprio `<html>/<body>` |
| Componentes client | `src/components/error-boundary.tsx` | Class component wrapping o conteúdo via `error-boundary-wrapper.tsx` |

---

### 2.9 Data Fetching Patterns

**Princípio:** Buscar tudo junto, em paralelo, no servidor.

**Dashboard:** 10 queries simultâneas via `Promise.all` (`page.tsx:103-114`)
```tsx
const [mentees, revenues, testimonials, indications, engagements,
       csActivities, stageChanges, calls, wppOut, wppIn] = await Promise.all([...])
```

**Impacto:** 1 round-trip ao banco em vez de 10 sequenciais.

---

### 2.10 Bundle Size Management

**Princípio:** Tree-shaking + dynamic imports para libs > 50KB.

| Lib | Tamanho | Estratégia |
|---|---|---|
| `lucide-react` | Tree-shakeable | `import { X } from` — só ícones usados |
| `jsPDF` + `html2canvas` | ~150KB | `await import()` inline |
| `stream-chat-react` | ~200KB | Rota separada `/chat/[token]` |
| `@dnd-kit` | ~30KB | Necessário no kanban — carrega com a página |
| `zustand` | ~3KB | Leve, sem overhead |

---

### 2.11 Critical Rendering Path

**Princípio:** Não bloquear o primeiro paint.

**Implementação:**
- `next/font` com `localFont` → CSS inline automático, zero FOUT
- Server Components → HTML renderizado no servidor, sem JS blocking
- `SplashScreen` → animação CSS pura durante hydration

---

### 2.12 Layout Shift Prevention (CLS)

**Princípio:** Sempre definir dimensões em containers dinâmicos.

**Implementação:**
- Metric cards: `min-h-[88px]` (`dashboard-metrics.tsx`)
- Image containers no chat: `min-h-[100px]` (`tab-chat.tsx`)
- Mentorados grid: `min-h-[200px]` (`mentorados-list.tsx`)
- Kanban columns: `min-h-[200px]` (já existia)
- `<Image>` com `width` e `height` sempre definidos

---

### 2.13 Virtualization

**Princípio:** Só virtualizar com 100+ items visíveis.

**Status atual:** Não implementado — o kanban tem < 50 mentees por tipo. Quando escalar para 100+, aplicar `react-window` nas colunas do kanban.

---

### 2.14 Prefetching & Preloading

**Princípio:** Antecipar o que o usuário vai clicar.

**Implementação:** `src/components/sidebar-nav-item.tsx`
```tsx
const handlePrefetch = useCallback(() => {
  if (!isActive) router.prefetch(item.href)
}, [isActive, item.href, router])

<Link onMouseEnter={handlePrefetch} onTouchStart={handlePrefetch} ... />
```

**Impacto:** Ao passar o mouse sobre um link do sidebar, o Next.js já começa a buscar a página. Navegação parece instantânea.

---

### 2.15 State Management Efficiency

**Princípio:** State o mais local possível.

| Escopo | Tecnologia | Uso |
|---|---|---|
| Componente | `useState` | Formulários, toggles, filtros |
| Funcionalidade | `useCallback`/`useMemo` | Kanban sorting, memoização |
| Global | Zustand | Call store (estado da ligação ativa) |
| Server | React Query | Cache de dados entre navegações |
| Realtime | Supabase Realtime | Chat messages, unread counts |

---

### 2.16 Responsive Loading

**Princípio:** Carregar menos no mobile.

**Implementação:**
- Kanban: `snap-x snap-mandatory` para scroll horizontal no mobile
- Modais: `fullscreen` no mobile, dialog no desktop
- Grids: empilham em `grid-cols-1` no mobile, expandem no desktop
- Dashboard cards: `p-3` no mobile, `p-4` no desktop

---

### 2.17 Service Worker / PWA Cache

**Princípio:** CacheFirst para assets, NetworkFirst para API.

**Configuração completa no `next.config.mjs`** com 6 regras de caching separadas por tipo de recurso.

---

### 2.18 Database Query Optimization

**Princípio:** `select('campos')` + count queries otimizadas.

| Padrão | Onde |
|---|---|
| `select('id, full_name, ...')` em vez de `select('*')` | Layout, admin, API routes |
| `select('id', { count: 'exact', head: true })` | Dashboard contagens |
| `MenteeSummary` (16 campos) em vez de `MenteeRow` (53 campos) | Kanban, lista mentorados |
| Full fetch on-demand no painel | `mentee-panel.tsx` busca `select('*')` ao abrir |
| `Pick<CallRecord, ...>` | Tab chat — 6 campos em vez de 11 |

**Tipo `MenteeSummary`** (`src/types/kanban.ts`):
```tsx
export const MENTEE_SUMMARY_FIELDS = 'id, full_name, phone, email, instagram,
  product_name, city, state, status, cliente_fit, priority_level,
  kanban_type, current_stage_id, start_date, created_at, created_by'

export type MenteeSummary = Pick<MenteeRow, 'id' | 'full_name' | 'phone' | ...>
```

---

### 2.19 Accessibility

**Princípio:** `aria-label` em botões com ícone. Tab order correto.

**11 botões corrigidos:**
- Chat: Anexar arquivo, Gravar áudio, Enviar mensagem, Remover arquivo, Cancelar áudio
- Mentee panel: Editar/Excluir objetivo, Editar/Excluir indicação, Editar/Excluir intensivo
- Kanban: Novo mentorado (FAB mobile) — já existia
- Sidebar: Abrir/Fechar menu — já existiam

---

### 2.20 Web Vitals Monitoring

**Princípio:** O que não se mede, não se melhora.

**Arquivo:** `src/components/web-vitals.tsx`

| Métrica | Threshold (bom) | O que mede |
|---|---|---|
| LCP | < 2500ms | Tempo até o maior elemento visível renderizar |
| FID | < 100ms | Tempo de resposta ao primeiro input |
| CLS | < 0.1 | Quanto o layout "pula" durante o carregamento |
| FCP | < 1800ms | Tempo até o primeiro conteúdo visível |
| TTFB | < 800ms | Tempo até o primeiro byte do servidor |
| INP | < 200ms | Responsividade geral a interações |

**Comportamento:**
- Dev: loga todas as métricas com status OK/SLOW
- Prod: avisa (console.warn) apenas quando excede o threshold

---

## 3. Edge Runtime

**4 API routes no Edge Runtime** (latência ~50ms):

| Route | Motivo |
|---|---|
| `/api/webhooks/endpoints` | Listagem — read-only Supabase |
| `/api/webhooks/logs` | Listagem de logs |
| `/api/webhooks/logs/[id]` | Detalhe de log |
| `/api/whatsapp/messages/[menteeId]` | Histórico de mensagens |

**Não elegíveis para Edge:** routes que usam `web-push` (crypto Node.js), `stream-chat`, `daily-co`.

---

## 4. Supabase Client Singleton

**Arquivo:** `src/lib/supabase/client.ts`

```tsx
let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (client) return client
  client = createBrowserClient<Database>(...)
  return client
}
```

**Impacto:** Reutiliza a mesma conexão WebSocket entre renders. Evita criar múltiplas conexões Realtime.

---

## 5. Mapa de Arquivos

### Criados (16 arquivos)
```
src/components/ui/skeleton.tsx              — Componente skeleton
src/components/error-boundary.tsx           — Error boundary class component
src/components/error-boundary-wrapper.tsx   — Wrapper client
src/components/web-vitals.tsx               — Web Vitals monitor
src/components/query-provider.tsx           — React Query provider
src/components/hydrate-query.tsx            — Server→client data hydration
src/hooks/use-debounce.ts                  — Hook de debounce genérico
src/app/(dashboard)/loading.tsx             — Skeleton dashboard
src/app/(dashboard)/etapas-iniciais/loading.tsx
src/app/(dashboard)/etapas-mentoria/loading.tsx
src/app/(dashboard)/mentorados/loading.tsx
src/app/(dashboard)/depoimentos/loading.tsx
src/app/(dashboard)/objetivos/loading.tsx
src/app/(dashboard)/admin/loading.tsx
src/app/(dashboard)/error.tsx               — Error boundary dashboard
src/app/global-error.tsx                    — Error boundary global
```

### Modificados (20+ arquivos)
```
next.config.mjs                             — remotePatterns S3 + Supabase
src/app/(dashboard)/layout.tsx              — QueryProvider + ErrorBoundary
src/app/layout.tsx                          — WebVitals
src/lib/supabase/client.ts                 — Singleton pattern
src/types/kanban.ts                        — MenteeSummary + MENTEE_SUMMARY_FIELDS
src/components/dashboard-metrics.tsx       — Debounce + min-h
src/components/mentorados-list.tsx         — Debounce search + MenteeSummary type
src/components/kanban/mentee-panel.tsx     — next/image + aria-labels + full fetch on-demand
src/components/kanban/tab-chat.tsx         — next/image + resolveMediaUrl + aria-labels
src/components/admin-user-list.tsx         — dynamic() WebhooksSection
src/components/sidebar-nav-item.tsx        — Prefetch on hover/touch
src/app/(dashboard)/etapas-iniciais/page.tsx   — MENTEE_SUMMARY_FIELDS
src/app/(dashboard)/etapas-mentoria/page.tsx   — MENTEE_SUMMARY_FIELDS
src/app/(dashboard)/mentorados/page.tsx        — MENTEE_SUMMARY_FIELDS
src/app/(dashboard)/admin/page.tsx             — Select específico
src/app/api/webhooks/endpoints/route.ts        — Edge + select específico
src/app/api/webhooks/logs/route.ts             — Edge
src/app/api/webhooks/logs/[id]/route.ts        — Edge
src/app/api/whatsapp/messages/[menteeId]/route.ts — Edge + select específico
src/app/api/calls/create/route.ts              — Select específico
src/app/api/push/send/route.ts                 — Select específico
```

---

## 6. Dependências Adicionadas

| Pacote | Versão | Tamanho | Propósito |
|---|---|---|---|
| `@tanstack/react-query` | ^5 | ~40KB | Cache client, stale-while-revalidate |

---

## 7. Histórico de Commits

| Hash | Descrição |
|---|---|
| `e8e81cb` | Skeletons, debounce, error boundary, code split, next/image |
| `14b13ba` | error.tsx, global-error.tsx, aria-labels, CLS, Web Vitals |
| `2549283` | Select cleanup em API routes + debounce mentorados |
| `ba521f2` | React Query, MenteeSummary, Edge Runtime, sidebar prefetch |
| `408688d` | Rewrite WhatsApp NextTrack integration |
| `45e1dda` | Logging detalhado no webhook |
| `08a4e63` | Fix phone matching (last 8 digits) |

---

## 8. Princípios Fundamentais (Pareto 4x)

Após 4 iterações de Pareto nos 20 conceitos, tudo se resume a **4 princípios**:

1. **Mostre algo instantaneamente** — skeletons, optimistic UI
2. **Carregue só o necessário** — code split, select fields, lazy loading
3. **Falhe com elegância** — error boundaries, fallbacks
4. **Meça para melhorar** — Web Vitals, logging

---

## 9. Próximos Passos (quando escalar)

| Quando | Ação |
|---|---|
| 100+ mentorados por kanban | Implementar `react-window` (virtualização) |
| Múltiplos CS simultâneos | Server-side pagination com `.range()` |
| Latência > 2.5s no LCP | Suspense streaming granular por seção |
| Bundle > 500KB | Analisar com `@next/bundle-analyzer` |
| Erros em produção | Integrar Sentry ou similar |
