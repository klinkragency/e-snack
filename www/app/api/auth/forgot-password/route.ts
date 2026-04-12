import { backendFetch } from "@/lib/api"
import { parseBody } from "@/lib/api-validation"
import { z } from "zod"

const forgotPasswordBody = z.object({
  email: z.string().email().max(255),
})

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, forgotPasswordBody)
  if (error) return error

  const res = await backendFetch("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: data.email }),
  })

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    return Response.json(
      { message: body.message || "Erreur lors de l'envoi" },
      { status: res.status }
    )
  }

  return Response.json({ success: true, message: body.message || "Code envoyé" })
}
