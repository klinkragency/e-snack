import { authedBackendFetch } from "@/lib/api-auth"
import { parseBody } from "@/lib/api-validation"
import { z } from "zod"

const createPaymentBody = z.object({
  orderId: z.string().min(1),
})

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, createPaymentBody)
  if (error) return error

  const res = await authedBackendFetch(`/api/v1/orders/${data.orderId}/payment`, {
    method: "POST",
  })

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    return Response.json(
      { message: body.message || "Erreur lors de la création du paiement" },
      { status: res.status }
    )
  }

  return Response.json({
    checkoutUrl: body.checkoutUrl || body.checkout_url,
    paymentId: body.id,
  })
}
