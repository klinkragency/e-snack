import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  const data = await request.json()
  const res = await authedBackendFetch(`/api/v1/admin/restaurants/reorder`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
