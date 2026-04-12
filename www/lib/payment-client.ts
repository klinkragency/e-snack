export interface CreateOrderRequest {
  restaurantId: string
  orderType: "delivery" | "pickup" | "dine_in"
  deliveryAddress?: string
  deliveryLat?: number
  deliveryLng?: number
  deliveryInstructions?: string
  promoCode?: string
  customerNotes?: string
  paymentType?: "online" | "on_site"
  scheduledPickupTime?: string // ISO 8601
  items: {
    productId?: string
    quantity: number
    notes?: string
    options?: { optionChoiceId: string }[]
    // Formula fields
    itemType?: "product" | "formula"
    formulaId?: string
    formulaSelections?: {
      productId: string
      optionChoiceIds: string[]
    }[]
  }[]
}

export interface CreateOrderResponse {
  id: string
  status: string
  total: number
}

export interface PaymentResponse {
  checkoutUrl: string
  paymentId: string
}

export async function createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur" }))
    throw new Error(err.message || "Erreur lors de la création de la commande")
  }
  return res.json()
}

export async function createPayment(orderId: string): Promise<PaymentResponse> {
  const res = await fetch("/api/orders/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur" }))
    throw new Error(err.message || "Erreur lors de la création du paiement")
  }
  return res.json()
}
