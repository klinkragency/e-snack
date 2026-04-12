import { toast } from "sonner"

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

/**
 * Handle API response errors with consistent behavior:
 * - 401: redirect to login
 * - 429: rate limit toast
 * - Others: throw ApiError
 */
export async function handleApiResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json()

  const body = await res.json().catch(() => ({ message: "Erreur inconnue" }))
  const message = body.message || `Erreur ${res.status}`

  if (res.status === 401) {
    // Redirect to login only in browser
    if (typeof window !== "undefined") {
      window.location.href = "/authentification"
    }
    throw new ApiError("Session expirée", 401)
  }

  if (res.status === 429) {
    toast.error("Trop de requêtes. Réessayez dans un instant.")
    throw new ApiError(message, 429)
  }

  throw new ApiError(message, res.status)
}

/**
 * Convenience: show toast for any caught error
 */
export function toastError(err: unknown, fallback = "Une erreur est survenue") {
  if (err instanceof ApiError) {
    if (err.status !== 401) toast.error(err.message)
  } else if (err instanceof Error) {
    toast.error(err.message || fallback)
  } else {
    toast.error(fallback)
  }
}
