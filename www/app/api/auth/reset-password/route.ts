import { backendFetch } from "@/lib/api"
import { parseBody } from "@/lib/api-validation"
import { z } from "zod"

const resetPasswordBody = z.object({
  resetToken: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, resetPasswordBody)
  if (error) return error

  const res = await backendFetch("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({
      reset_token: data.resetToken,
      new_password: data.newPassword,
    }),
  })

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    return Response.json(
      { message: body.message || "Erreur lors de la réinitialisation" },
      { status: res.status }
    )
  }

  return Response.json({ success: true })
}
