import { authedBackendFetch } from "@/lib/api-auth"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params
  const res = await authedBackendFetch(`/api/v1/admin/promos/${id}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}

export async function PUT(request: Request, context: Context) {
  const { id } = await context.params
  const data = await request.json()

  // Transform camelCase to snake_case for backend
  const backendData: Record<string, unknown> = {
    id,
  }

  if (data.code !== undefined) backendData.code = data.code
  if (data.discountType !== undefined) backendData.discount_type = data.discountType
  if (data.discountValue !== undefined) backendData.discount_value = data.discountValue
  if (data.minOrderAmount !== undefined) backendData.min_order_amount = data.minOrderAmount
  if (data.maxDiscountAmount !== undefined) backendData.max_discount_amount = data.maxDiscountAmount
  if (data.maxTotalUses !== undefined) backendData.max_total_uses = data.maxTotalUses
  if (data.maxUsesPerUser !== undefined) backendData.max_uses_per_user = data.maxUsesPerUser
  if (data.firstOrderOnly !== undefined) backendData.first_order_only = data.firstOrderOnly
  if (data.startsAt !== undefined) backendData.starts_at = data.startsAt
  if (data.expiresAt !== undefined) backendData.expires_at = data.expiresAt
  if (data.isActive !== undefined) backendData.is_active = data.isActive
  if (data.description !== undefined) backendData.description = data.description
  if (data.restaurantIds !== undefined) backendData.restaurant_ids = data.restaurantIds
  if (data.isPrivate !== undefined) backendData.is_private = data.isPrivate
  if (data.requiresClaim !== undefined) backendData.requires_claim = data.requiresClaim

  const res = await authedBackendFetch(`/api/v1/admin/promos/${id}`, {
    method: "PUT",
    body: JSON.stringify(backendData),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params
  const res = await authedBackendFetch(`/api/v1/admin/promos/${id}`, {
    method: "DELETE",
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
