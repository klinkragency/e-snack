import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await request.json()
  const res = await authedBackendFetch(`/api/v1/admin/orders/${id}/assign`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
