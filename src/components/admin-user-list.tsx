'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Shield, User } from 'lucide-react'
import { updateUserRole } from '@/lib/actions/admin-actions'
import type { Database, UserRole } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AdminUserListProps {
  users: Profile[]
  currentUserId: string
}

export function AdminUserList({ users, currentUserId }: AdminUserListProps) {
  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-foreground">Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gestão de usuários do sistema
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
    </div>
  )
}

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
