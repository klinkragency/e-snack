"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createRestaurant } from "@/lib/admin-client"
import { ImageUpload } from "@/components/image-upload"

export default function NewRestaurantPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [isPending, setIsPending] = useState(false)

  const autoSlug = (value: string) => {
    setName(value)
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) {
      toast.error("Nom et slug sont requis")
      return
    }
    setIsPending(true)
    try {
      await createRestaurant({ name, slug, description, address, logoUrl, bannerUrl })
      toast.success("Restaurant créé !")
      router.push("/admin/restaurants")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="px-4 py-4 md:px-8 md:py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/restaurants"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nouveau restaurant</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nom *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => autoSlug(e.target.value)}
            placeholder="Smash Burger"
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Slug *</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="smash-burger"
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20 font-mono"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">URL: /restaurant/{slug || "..."}</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Une brève description du restaurant..."
            rows={3}
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Adresse</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="12 Avenue de la Costa, Monaco"
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Logo</label>
          <ImageUpload value={logoUrl} onChange={setLogoUrl} category="restaurant_logo" className="w-32" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Bannière</label>
          <ImageUpload value={bannerUrl} onChange={setBannerUrl} category="restaurant_banner" aspectRatio="aspect-[2/1]" />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : "Créer le restaurant"}
        </button>
      </form>
    </div>
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
