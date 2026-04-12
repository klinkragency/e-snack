import { authedBackendFetch } from "@/lib/api-auth"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const { id } = await context.params
  const { searchParams } = new URL(request.url)

  const params = new URLSearchParams()
  const page = searchParams.get("page") || "1"
  const pageSize = searchParams.get("pageSize") || "20"
  const status = searchParams.get("status")

  params.set("page", page)
  params.set("page_size", pageSize)
  if (status) params.set("status_filter", status)

  const res = await authedBackendFetch(`/api/v1/admin/promos/${id}/assignments?${params}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
