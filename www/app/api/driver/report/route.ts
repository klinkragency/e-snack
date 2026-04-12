import { NextRequest } from "next/server"
import { authedBackendFetch } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""
  const qs = new URLSearchParams()
  if (from) qs.set("from_date", from)
  if (to) qs.set("to_date", to)
  const res = await authedBackendFetch(`/api/v1/driver/report?${qs}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
