import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await authedBackendFetch(`/api/v1/driver/deliveries/${id}/accept`, {
    method: "POST",
    body: JSON.stringify({}),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
