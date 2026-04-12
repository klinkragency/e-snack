import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""

  const backendParams = new URLSearchParams()
  if (from) backendParams.set("from_date", from)
  if (to) backendParams.set("to_date", to)

  const res = await authedBackendFetch(`/api/v1/admin/drivers/${id}/report?${backendParams}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
