import { authedBackendFetch } from "@/lib/api-auth"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const { id } = await context.params
  const { searchParams } = new URL(request.url)

  const params = new URLSearchParams()
  params.set("page", searchParams.get("page") || "1")
  params.set("page_size", searchParams.get("pageSize") || "20")

  const res = await authedBackendFetch(`/api/v1/admin/promos/${id}/usage?${params}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
