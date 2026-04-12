import { NextRequest, NextResponse } from 'next/server'
import { backendFetch } from '@/lib/api'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authHeader = req.headers.get('Authorization') ?? ''

  try {
    const res = await backendFetch(`/api/v1/admin/mark-paid/${id}`, {
      method: 'PATCH',
      headers: { Authorization: authHeader },
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ message: 'Erreur serveur' }, { status: 500 })
  }
}
