import { authedBackendFetch } from "@/lib/api-auth"

export async function POST() {
  const res = await authedBackendFetch("/api/v1/auth/verify-email/send", {
    method: "POST",
    body: JSON.stringify({}),
  })

  const data = await res.json()
  return Response.json(data, { status: res.status })
}
