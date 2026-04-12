import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Get the order to find the payment intent ID
  const orderRes = await authedBackendFetch(`/api/v1/orders/${id}`)
  if (!orderRes.ok) {
    return Response.json({ message: "Order not found" }, { status: 404 })
  }

  const order = await orderRes.json()
  const paymentIntentId = order.paymentIntentId || order.payment_intent_id

  if (!paymentIntentId) {
    return Response.json({ message: "No payment intent found" }, { status: 400 })
  }

  // Confirm payment with backend
  const res = await authedBackendFetch(`/api/v1/payments/${paymentIntentId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ payment_intent_id: paymentIntentId }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return Response.json(
      { message: data.message || "Failed to confirm payment" },
      { status: res.status }
    )
  }

  return Response.json(data)
}
