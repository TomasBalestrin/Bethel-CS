import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQRCode } from '@/lib/nextapps'

export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const supabase = createClient()

  // Only admin can access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas admin' }, { status: 403 })
  }

  const result = await getQRCode(params.instanceId)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ascii: result.ascii, status: result.status })
}
