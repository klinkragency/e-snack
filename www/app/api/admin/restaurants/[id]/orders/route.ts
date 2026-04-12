import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const orderType = searchParams.get("order_type")
  const qs = status ? `?status=${status}` : ""
  const res = await authedBackendFetch(`/api/v1/admin/restaurants/${id}/orders${qs}`)
  const body = await res.json().catch(() => ({}))
  // Filter by order type in BFF since the proto endpoint doesn't expose this param yet
  if (res.ok && orderType && body.orders) {
    if (orderType === "scheduled") {
      // "Planifiées" = orders with a scheduled_pickup_time set
      body.orders = body.orders.filter((o: { scheduledPickupTime?: string; scheduled_pickup_time?: string }) =>
        !!(o.scheduledPickupTime ?? o.scheduled_pickup_time)
      )
    } else {
      body.orders = body.orders.filter((o: { orderType?: string; order_type?: string }) => {
        const type = o.orderType ?? o.order_type
        return type === orderType
      })
    }
  }
  return Response.json(body, { status: res.status })
}
