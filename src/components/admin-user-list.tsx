'use client'

import { useState } from 'react'
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
import { Separator } from '@/components/ui/separator'
import { Shield, User, Plus, Trash2, Package } from 'lucide-react'
import { updateUserRole, createProduct, deleteProduct } from '@/lib/actions/admin-actions'
import type { Database, UserRole } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Product = Database['public']['Tables']['products']['Row']

interface AdminUserListProps {
  users: Profile[]
  products: Product[]
  currentUserId: string
}

export function AdminUserList({ users, products, currentUserId }: AdminUserListProps) {
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gestão de usuários e produtos do sistema
      </p>

      <div className="mt-6 space-y-3">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            isCurrentUser={user.id === currentUserId}
          />
        ))}
      </div>

      <Separator className="my-8" />

      <ProductsSection products={products} />
    </div>
  )
}

// ─── User Row ───
function UserRow({
  user,
  isCurrentUser,
}: {
  user: Profile
  isCurrentUser: boolean
}) {
  const [role, setRole] = useState<UserRole>(user.role)
  const [loading, setLoading] = useState(false)

  const initials = user.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleRoleChange(newRole: string) {
    const typedRole = newRole as UserRole
    setLoading(true)
    const result = await updateUserRole(user.id, typedRole)
    if (!result.error) {
      setRole(typedRole)
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4 shadow-card animate-fade-in">
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
            {role === 'admin' ? (
              <Shield className="h-3 w-3" />
            ) : (
              <User className="h-3 w-3" />
            )}
            {role === 'admin' ? 'Administrador' : 'Especialista'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isCurrentUser ? (
          <Badge variant="accent">Admin</Badge>
        ) : (
          <Select value={role} onValueChange={handleRoleChange} disabled={loading}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Administrador</SelectItem>
              <SelectItem value="especialista">Especialista</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}

// ─── Products Section ───
function ProductsSection({ products }: { products: Product[] }) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [productName, setProductName] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!productName.trim()) return
    setLoading(true)
    await createProduct(productName.trim())
    setProductName('')
    setDialogOpen(false)
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
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Produtos
          </h2>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
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
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={deletingId === product.id}
              onClick={() => handleDelete(product.id, product.name)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Produto</DialogTitle>
            <DialogDescription>
              Cadastre um produto para usar no registro de receita.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="product-name">Nome do produto *</Label>
              <Input
                id="product-name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
