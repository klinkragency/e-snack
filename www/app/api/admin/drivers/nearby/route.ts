import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get("lat") || ""
  const lng = searchParams.get("lng") || ""
  const radiusKm = searchParams.get("radiusKm") || "5"

  const params = new URLSearchParams({ lat, lng, radius_km: radiusKm })

  const res = await authedBackendFetch(`/api/v1/admin/drivers/nearby?${params}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
