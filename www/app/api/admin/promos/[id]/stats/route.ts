import { authedBackendFetch } from "@/lib/api-auth"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params
  const res = await authedBackendFetch(`/api/v1/admin/promos/${id}/stats`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
