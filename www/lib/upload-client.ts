const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav"]
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_AUDIO_SIZE = 2 * 1024 * 1024 // 2MB

export type UploadCategory = "restaurant_logo" | "restaurant_banner" | "product"

export async function uploadImage(
  file: File,
  category: UploadCategory
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Format accepté : JPEG, PNG ou WebP")
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Taille max : 5 Mo")
  }

  const formData = new FormData()
  formData.append("file", file, file.name)
  formData.append("category", category)

  const res = await fetch("/api/upload/file", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur upload" }))
    throw new Error(err.message || "Échec de l'upload du fichier")
  }

  const { publicUrl } = await res.json()
  return publicUrl
}

export async function uploadAudio(file: File): Promise<string> {
  const type = file.type || "audio/mpeg"
  if (!ALLOWED_AUDIO_TYPES.includes(type)) {
    throw new Error("Format accepté : MP3 ou WAV")
  }
  if (file.size > MAX_AUDIO_SIZE) {
    throw new Error("Taille max : 2 Mo")
  }

  const formData = new FormData()
  formData.append("file", file, file.name)
  formData.append("category", "notification_sound")

  const res = await fetch("/api/upload/file", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur upload" }))
    throw new Error(err.message || "Échec de l'upload audio")
  }

  const { publicUrl } = await res.json()
  return publicUrl
}
