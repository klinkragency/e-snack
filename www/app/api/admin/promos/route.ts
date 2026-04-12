import { authedBackendFetch } from "@/lib/api-auth"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()

  const page = searchParams.get("page") || "1"
  const pageSize = searchParams.get("pageSize") || "20"
  const search = searchParams.get("search")
  const activeOnly = searchParams.get("activeOnly")
  const typeFilter = searchParams.get("typeFilter")

  params.set("page", page)
  params.set("page_size", pageSize)
  if (search) params.set("search", search)
  if (activeOnly === "true") params.set("active_only", "true")
  if (typeFilter) params.set("type_filter", typeFilter)

  const res = await authedBackendFetch(`/api/v1/admin/promos?${params}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}

export async function POST(request: Request) {
  const data = await request.json()

  // Transform camelCase to snake_case for backend
  const backendData: Record<string, unknown> = {
    code: data.code,
    discount_type: data.discountType,
    discount_value: data.discountValue,
    description: data.description,
    restaurant_ids: data.restaurantIds || [],
  }

  if (data.minOrderAmount) backendData.min_order_amount = data.minOrderAmount
  if (data.maxDiscountAmount) backendData.max_discount_amount = data.maxDiscountAmount
  if (data.maxTotalUses) backendData.max_total_uses = data.maxTotalUses
  if (data.maxUsesPerUser) backendData.max_uses_per_user = data.maxUsesPerUser
  if (data.firstOrderOnly !== undefined) backendData.first_order_only = data.firstOrderOnly
  if (data.startsAt) backendData.starts_at = data.startsAt
  if (data.expiresAt) backendData.expires_at = data.expiresAt
  if (data.isPrivate !== undefined) backendData.is_private = data.isPrivate
  if (data.requiresClaim !== undefined) backendData.requires_claim = data.requiresClaim

  const res = await authedBackendFetch("/api/v1/admin/promos", {
    method: "POST",
    body: JSON.stringify(backendData),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
