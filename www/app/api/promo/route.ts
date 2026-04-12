import { authedBackendFetch } from "@/lib/api-auth"

export async function POST(request: Request) {
  const body = await request.json()

  // Transform camelCase to snake_case for backend
  const backendBody = {
    code: body.code,
    restaurant_id: body.restaurantId,
    subtotal: body.subtotal || 0,
    delivery_fee: body.deliveryFee || 0,
  }

  const res = await authedBackendFetch("/api/v1/promos/validate", {
    method: "POST",
    body: JSON.stringify(backendBody),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return Response.json(
      { message: data.message || data.error_message || "Code promo invalide" },
      { status: res.status }
    )
  }

  // Transform response to frontend format
  return Response.json({
    valid: data.valid,
    discountValue: data.discount_amount || data.discountAmount || 0,
    discountType: data.promo?.discount_type || data.promo?.discountType || "fixed_amount",
    requiresClaim: data.requires_claim || data.requiresClaim,
    isClaimed: data.is_claimed || data.isClaimed,
    message: data.error_message || data.errorMessage,
  })
}
