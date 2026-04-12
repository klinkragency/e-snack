import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await authedBackendFetch(`/api/v1/admin/drivers/${id}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
