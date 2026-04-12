import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await request.json()
  const res = await authedBackendFetch(`/api/v1/admin/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
