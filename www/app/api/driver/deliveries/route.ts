import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const qs = status ? `?status=${status}` : ""
  const res = await authedBackendFetch(`/api/v1/driver/deliveries${qs}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
