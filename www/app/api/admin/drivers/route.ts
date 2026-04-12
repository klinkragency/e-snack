import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get("page") || "1"
  const pageSize = searchParams.get("pageSize") || "20"
  const status = searchParams.get("status") || ""

  const params = new URLSearchParams({ page, page_size: pageSize })
  if (status) params.set("status", status)

  const res = await authedBackendFetch(`/api/v1/admin/drivers?${params}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
