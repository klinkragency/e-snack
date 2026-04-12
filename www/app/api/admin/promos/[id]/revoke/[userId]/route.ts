import { authedBackendFetch } from "@/lib/api-auth"

type Context = { params: Promise<{ id: string; userId: string }> }

export async function POST(request: Request, context: Context) {
  const { id, userId } = await context.params
  const data = await request.json()

  const backendData: Record<string, unknown> = {
    promo_id: id,
    user_id: userId,
    reason: data.reason || "",
  }

  const res = await authedBackendFetch(`/api/v1/admin/promos/${id}/revoke/${userId}`, {
    method: "POST",
    body: JSON.stringify(backendData),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
