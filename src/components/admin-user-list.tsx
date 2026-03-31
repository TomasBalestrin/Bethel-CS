'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, User, Plus, Pencil, Trash2, Package, MessageSquare, Wifi, WifiOff, Webhook } from 'lucide-react'
import { WebhooksSection } from '@/components/admin-webhooks'
import {
  createUser,
  updateUser,
  deleteUser,
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/lib/actions/admin-actions'
import type { Database, UserRole } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Product = Database['public']['Tables']['products']['Row']
type WppInstance = Database['public']['Tables']['wpp_instances']['Row']

interface KanbanStage {
  id: string
  name: string
  type: string
}

interface AdminUserListProps {
  users: Profile[]
  products: Product[]
  wppInstances: WppInstance[]
  kanbanStages: KanbanStage[]
  currentUserId: string
}

export function AdminUserList({ users, products, wppInstances, kanbanStages, currentUserId }: AdminUserListProps) {
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gestão de usuários, produtos, WhatsApp e webhooks do sistema
      </p>

      <Tabs defaultValue="users" className="mt-6">
        <div className="overflow-x-auto scrollbar-none">
          <TabsList className="min-w-max">
            <TabsTrigger value="users"><User className="h-4 w-4 mr-1.5" />Usuários</TabsTrigger>
            <TabsTrigger value="products"><Package className="h-4 w-4 mr-1.5" />Produtos</TabsTrigger>
            <TabsTrigger value="whatsapp"><MessageSquare className="h-4 w-4 mr-1.5" />WhatsApp</TabsTrigger>
            <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1.5" />Webhooks</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users">
          <UsersSection users={users} currentUserId={currentUserId} />
        </TabsContent>

        <TabsContent value="products">
          <ProductsSection products={products} />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppSection
            specialists={users.filter((u) => u.role === 'especialista')}
            instances={wppInstances}
          />
        </TabsContent>

        <TabsContent value="webhooks">
          <WebhooksSection
            specialists={users.filter((u) => u.role === 'especialista').map((u) => ({ id: u.id, full_name: u.full_name, role: u.role }))}
            kanbanStages={kanbanStages}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ═══════════════════════════════════════
// USERS SECTION
// ═══════════════════════════════════════

function UsersSection({ users, currentUserId }: { users: Profile[]; currentUserId: string }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Create form
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('especialista')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit form
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('especialista')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function openEdit(user: Profile) {
    setEditName(user.full_name)
    setEditRole(user.role)
    setEditError(null)
    setEditingUser(user)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError(null)
    const result = await createUser({
      email: newEmail,
      password: newPassword,
      full_name: newName,
      role: newRole,
    })
    setCreateLoading(false)
    if (result.error) { setCreateError(result.error); return }
    setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('especialista')
    setCreateOpen(false)
    router.refresh()
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return
    setEditLoading(true)
    setEditError(null)
    const result = await updateUser(editingUser.id, {
      full_name: editName,
      role: editRole,
    })
    setEditLoading(false)
    if (result.error) { setEditError(result.error); return }
    setEditingUser(null)
    router.refresh()
  }

  async function handleDelete(userId: string, userName: string) {
    const confirmed = window.confirm(`Excluir o usuário "${userName}"?`)
    if (!confirmed) return
    setDeletingId(userId)
    await deleteUser(userId)
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-heading text-xl font-semibold text-foreground">Usuários</h2>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar usuário
        </Button>
      </div>

      <div className="space-y-3">
        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId
          const initials = user.full_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()

          return (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-card animate-fade-in"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-accent text-accent-foreground text-sm font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">
                    {user.full_name}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                    )}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {user.role === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {user.role === 'admin' ? 'Administrador' : 'Especialista'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isCurrentUser ? (
                  <Badge variant="accent">Admin</Badge>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(user.id, user.full_name)}
                      disabled={deletingId === user.id}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Cadastre um novo usuário no sistema.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="new-name">Nome completo *</Label>
              <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-email">Email *</Label>
              <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-password">Senha *</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-1">
              <Label>Role *</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="especialista">Especialista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createLoading}>
                {createLoading ? 'Salvando...' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere os dados do usuário.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-name">Nome completo *</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Role *</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="especialista">Especialista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════
// PRODUCTS SECTION
// ═══════════════════════════════════════

function ProductsSection({ products }: { products: Product[] }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productName, setProductName] = useState('')
  const [editProductName, setEditProductName] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!productName.trim()) return
    setLoading(true)
    await createProduct(productName.trim())
    setProductName('')
    setCreateOpen(false)
    setLoading(false)
    router.refresh()
  }

  function openEditProduct(product: Product) {
    setEditProductName(product.name)
    setEditingProduct(product)
  }

  async function handleEditProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProduct || !editProductName.trim()) return
    setLoading(true)
    await updateProduct(editingProduct.id, editProductName.trim())
    setEditingProduct(null)
    setLoading(false)
    router.refresh()
  }

  async function handleDelete(productId: string, name: string) {
    const confirmed = window.confirm(`Excluir o produto "${name}"?`)
    if (!confirmed) return
    setDeletingId(productId)
    await deleteProduct(productId)
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-heading text-xl font-semibold text-foreground">Produtos</h2>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar produto
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
        )}
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-card animate-fade-in"
          >
            <span className="text-sm font-medium text-foreground">{product.name}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openEditProduct(product)}
                className="rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(product.id, product.name)}
                disabled={deletingId === product.id}
                className="rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Product Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
            <DialogDescription>Cadastre um produto para usar no registro de receita.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="product-name">Nome do produto *</Label>
              <Input id="product-name" value={productName} onChange={(e) => setProductName(e.target.value)} required autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => { if (!open) setEditingProduct(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>Altere o nome do produto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditProduct} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-product-name">Nome do produto *</Label>
              <Input id="edit-product-name" value={editProductName} onChange={(e) => setEditProductName(e.target.value)} required autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════
// WHATSAPP SECTION
// ═══════════════════════════════════════

function WhatsAppSection({ specialists, instances }: { specialists: Profile[]; instances: WppInstance[] }) {
  const router = useRouter()
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null)
  const [qrSpecialistName, setQrSpecialistName] = useState('')
  const [qrAscii, setQrAscii] = useState<string | null>(null)
  const [qrConnected, setQrConnected] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Configure/edit instance state
  const [configSpecialist, setConfigSpecialist] = useState<Profile | null>(null)
  const [configInstanceId, setConfigInstanceId] = useState('')
  const [configPhone, setConfigPhone] = useState('')
  const [configSaving, setConfigSaving] = useState(false)
  const [editingInstance, setEditingInstance] = useState(false) // true = edit existing, false = new

  const instanceMap = new Map(instances.map((i) => [i.specialist_id, i]))

  function openConfig(specialist: Profile) {
    const existing = instanceMap.get(specialist.id)
    if (existing) {
      setConfigInstanceId(existing.instance_id)
      setConfigPhone(existing.phone_number || '')
      setEditingInstance(true)
    } else {
      setConfigInstanceId('')
      setConfigPhone('')
      setEditingInstance(false)
    }
    setConfigSpecialist(specialist)
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault()
    if (!configSpecialist || !configInstanceId.trim()) return
    setConfigSaving(true)

    try {
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const existing = instanceMap.get(configSpecialist.id)

      if (existing) {
        // Update
        await supabase
          .from('wpp_instances')
          .update({
            instance_id: configInstanceId.trim(),
            phone_number: configPhone.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        // Insert
        await supabase.from('wpp_instances').insert({
          specialist_id: configSpecialist.id,
          instance_id: configInstanceId.trim(),
          phone_number: configPhone.trim() || null,
          status: 'connected',
        })
      }

      setConfigSpecialist(null)
      router.refresh()
    } catch (err) {
      console.error('Save instance error:', err)
    } finally {
      setConfigSaving(false)
    }
  }

  function openQR(specialist: Profile, instanceId: string) {
    setQrSpecialistName(specialist.full_name)
    setQrInstanceId(instanceId)
    setQrAscii(null)
    setQrConnected(false)
    fetchQR(instanceId)
  }

  async function fetchQR(instanceId: string) {
    setQrLoading(true)
    try {
      const res = await fetch(`/api/whatsapp/qrcode/${instanceId}`)
      const data = await res.json()

      if (data.status === true) {
        setQrConnected(true)
        stopPolling()
        router.refresh()
        return
      }

      setQrAscii(data.ascii || null)

      if (!pollingRef.current) {
        pollingRef.current = setInterval(() => fetchQR(instanceId), 3000)
      }
    } catch {
      setQrAscii(null)
    } finally {
      setQrLoading(false)
    }
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  function closeQR() {
    stopPolling()
    setQrInstanceId(null)
    setQrAscii(null)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-green-600" />
        <h2 className="font-heading text-xl font-semibold text-foreground">WhatsApp</h2>
      </div>

      <div className="space-y-3">
        {specialists.map((specialist) => {
          const instance = instanceMap.get(specialist.id)
          const isConnected = instance?.status === 'connected'
          const initials = specialist.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

          return (
            <div key={specialist.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={specialist.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-accent text-accent-foreground text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{specialist.full_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {instance ? (
                      <>
                        <Badge variant={isConnected ? 'success' : 'muted'} className="text-[10px]">
                          {isConnected ? (
                            <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
                          ) : (
                            <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
                          )}
                        </Badge>
                        {instance.phone_number && (
                          <span className="text-xs text-muted-foreground">{instance.phone_number}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground/60">{instance.instance_id}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem instância configurada</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {instance && !isConnected && (
                  <Button size="sm" variant="outline" onClick={() => openQR(specialist, instance.instance_id)}>
                    Conectar
                  </Button>
                )}
                {instance && (
                  <Button size="sm" variant="ghost" onClick={() => openConfig(specialist)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {!instance && (
                  <Button size="sm" variant="outline" onClick={() => openConfig(specialist)}>
                    Configurar
                  </Button>
                )}
              </div>
            </div>
          )
        })}

        {specialists.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum especialista cadastrado</p>
        )}
      </div>

      {/* Configure/Edit Instance Modal */}
      <Dialog open={!!configSpecialist} onOpenChange={(open) => { if (!open) setConfigSpecialist(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingInstance ? 'Editar' : 'Configurar'} WhatsApp — {configSpecialist?.full_name}</DialogTitle>
            <DialogDescription>Vincule uma instância do Next Apps a este especialista.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveConfig} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="wpp-instance-id">Instance ID *</Label>
              <Input
                id="wpp-instance-id"
                value={configInstanceId}
                onChange={(e) => setConfigInstanceId(e.target.value)}
                placeholder="ex: 55_e54016"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wpp-phone">Telefone do WhatsApp</Label>
              <Input
                id="wpp-phone"
                value={configPhone}
                onChange={(e) => setConfigPhone(e.target.value)}
                placeholder="ex: +55 11 99999-0000"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setConfigSpecialist(null)}>Cancelar</Button>
              <Button type="submit" disabled={configSaving}>{configSaving ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={!!qrInstanceId} onOpenChange={(open) => { if (!open) closeQR() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp — {qrSpecialistName}</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho
            </DialogDescription>
          </DialogHeader>

          {qrConnected ? (
            <div className="flex flex-col items-center py-8">
              <Wifi className="h-10 w-10 text-green-500 mb-3" />
              <p className="text-sm font-medium text-foreground">WhatsApp conectado!</p>
            </div>
          ) : qrAscii ? (
            <div className="flex justify-center overflow-auto">
              <pre className="font-mono text-[4px] leading-none whitespace-pre">{qrAscii}</pre>
            </div>
          ) : qrLoading ? (
            <div className="flex flex-col items-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-accent" />
              <p className="mt-2 text-xs text-muted-foreground">Gerando QR Code...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8">
              <p className="text-sm text-muted-foreground">QR Code não disponível. Tente novamente.</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={closeQR}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
