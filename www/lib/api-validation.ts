import { z } from "zod"

const MAX_BODY_SIZE = 10_000 // 10KB

const passwordSchema = z
  .string()
  .min(8, "8 caractères minimum")
  .max(128, "128 caractères maximum")

export const loginBody = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
})

export const registerBody = z.object({
  email: z.string().email().max(255),
  password: passwordSchema,
  phone: z.string().regex(/^\+?[0-9]{7,15}$/).optional(),
})

export const changePasswordBody = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
})

export const profileBody = z.object({
  name: z.string().max(100).optional(),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/).optional(),
})

export const createAddressBody = z.object({
  label: z.string().min(1).max(50),
  address: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
})

export const updateAddressBody = createAddressBody.partial()

export const verifyEmailBody = z.object({
  code: z.string().regex(/^[0-9]{6}$/),
})

export const oauthBody = z.object({
  provider: z.enum(["google"]),
  id_token: z.string().min(1).max(5000),
})

export const uuidParam = z.string().uuid()

/**
 * Parse and validate a JSON request body with size limit.
 * Returns { data } on success or { error: Response } on failure.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<{ data: T; error?: never } | { data?: never; error: Response }> {
  const contentLength = request.headers.get("content-length")
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return { error: Response.json({ message: "Requête trop volumineuse" }, { status: 413 }) }
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { error: Response.json({ message: "JSON invalide" }, { status: 400 }) }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      error: Response.json(
        { message: result.error.errors[0]?.message || "Données invalides" },
        { status: 422 }
      ),
    }
  }
  return { data: result.data }
}
