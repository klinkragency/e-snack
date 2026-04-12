import { backendFetch } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const res = await backendFetch("/api/v1/maintenance")
    if (!res.ok) {
      return Response.json({ enabled: false }, {
        headers: { "Cache-Control": "no-store" },
      })
    }
    const data = await res.json()
    return Response.json(data, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return Response.json({ enabled: false }, {
      headers: { "Cache-Control": "no-store" },
    })
  }
}
