import { authedBackendFetch } from "@/lib/api-auth"

type Context = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: Context) {
  const { id } = await context.params
  const data = await request.json()

  const backendData: Record<string, unknown> = {
    promo_id: id,
    user_id: data.userId,
  }

  if (data.expiresAt !== undefined) backendData.expires_at = data.expiresAt
  if (data.notes !== undefined) backendData.notes = data.notes
  if (data.sendNotification !== undefined) backendData.send_notification = data.sendNotification

  const res = await authedBackendFetch(`/api/v1/admin/promos/${id}/assign`, {
    method: "POST",
    body: JSON.stringify(backendData),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
