"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Music, Volume2, X } from "lucide-react"
import { toast } from "sonner"
import { listAdminRestaurants, updateRestaurant, updateCustomization } from "@/lib/admin-client"
import { ImageUpload } from "@/components/image-upload"
import { uploadAudio } from "@/lib/upload-client"
import { BannerUpload } from "@/components/banner-upload"
import type { Restaurant } from "@/lib/restaurant-types"
import { cn } from "@/lib/utils"

const FONT_OPTIONS = ["Inter", "DM Sans", "Poppins", "Montserrat", "Roboto"]

export default function EditRestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [bannerPosition, setBannerPosition] = useState({ x: 50, y: 50 })

  // Customization
  const [primaryColor, setPrimaryColor] = useState("#FF6B00")
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF")
  const [font, setFont] = useState("Inter")
  const [theme, setTheme] = useState("light")
  const [pickupEnabled, setPickupEnabled] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [deliveryFee, setDeliveryFee] = useState(2.90)
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(0)
  const [deliveryTimeMin, setDeliveryTimeMin] = useState(25)
  const [deliveryTimeMax, setDeliveryTimeMax] = useState(35)
  const [notificationSoundUrl, setNotificationSoundUrl] = useState("")
  const [uploadingSound, setUploadingSound] = useState(false)

  useEffect(() => {
    listAdminRestaurants()
      .then((restaurants) => {
        const r = restaurants.find((r: Restaurant) => r.id === id)
        if (!r) {
          toast.error("Restaurant introuvable")
          router.push("/admin/restaurants")
          return
        }
        setName(r.name)
        setDescription(r.description || "")
        setAddress(r.address || "")
        setLogoUrl(r.logoUrl || "")
        setBannerUrl(r.bannerUrl || "")
        if (r.bannerPosition) {
          // Handle both string (from API) and object formats
          const pos = typeof r.bannerPosition === "string"
            ? JSON.parse(r.bannerPosition)
            : r.bannerPosition
          if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
            setBannerPosition(pos)
          }
        }
        if (r.customization) {
          setPrimaryColor(r.customization.primaryColor || "#FF6B00")
          setSecondaryColor(r.customization.secondaryColor || "#FFFFFF")
          setFont(r.customization.font || "Inter")
          setTheme(r.customization.theme || "light")
        }
        setPickupEnabled(!!r.pickupEnabled)
        setIsActive(r.isActive !== false)
        if (r.deliveryFee != null) setDeliveryFee(r.deliveryFee)
        if (r.freeDeliveryThreshold != null) setFreeDeliveryThreshold(r.freeDeliveryThreshold)
        if (r.deliveryTimeMin != null) setDeliveryTimeMin(r.deliveryTimeMin)
        if (r.deliveryTimeMax != null) setDeliveryTimeMax(r.deliveryTimeMax)
        if (r.notificationSoundUrl) setNotificationSoundUrl(r.notificationSoundUrl)
      })
      .catch(() => toast.error("Erreur chargement"))
      .finally(() => setLoading(false))
  }, [id, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Le nom est requis")
      return
    }
    setSaving(true)
    try {
      await Promise.all([
        updateRestaurant(id, { name, description, address, logoUrl, bannerUrl, bannerPosition: JSON.stringify(bannerPosition), pickupEnabled, isActive, deliveryFee, freeDeliveryThreshold, deliveryTimeMin, deliveryTimeMax, notificationSoundUrl: notificationSoundUrl || undefined }),
        updateCustomization(id, { primaryColor, secondaryColor, font, theme }),
      ])
      toast.success("Restaurant mis à jour !")
      router.push("/admin/restaurants")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
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
        <h1 className="text-2xl font-bold tracking-tight">Modifier le restaurant</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nom *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Logo</label>
          <ImageUpload value={logoUrl} onChange={setLogoUrl} category="restaurant_logo" className="w-32" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Bannière</label>
          <BannerUpload
            value={bannerUrl}
            onChange={setBannerUrl}
            position={bannerPosition}
            onPositionChange={setBannerPosition}
            category="restaurant_banner"
            aspectRatio="aspect-[2/1]"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Cliquez sur l&apos;icône de déplacement pour repositionner le point focal de l&apos;image
          </p>
        </div>

        {/* Customization section */}
        <div className="border-t pt-5 mt-5">
          <h2 className="text-lg font-semibold mb-4">Personnalisation</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Couleur principale</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded-lg border-0 p-0"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Couleur secondaire</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded-lg border-0 p-0"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1.5">Police</label>
            <select
              value={font}
              onChange={(e) => setFont(e.target.value)}
              className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1.5">Theme</label>
            <div className="flex gap-3">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={cn(
                    "flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                    theme === t ? "border-foreground bg-foreground/5" : "hover:border-foreground/20"
                  )}
                >
                  {t === "light" ? "Clair" : "Sombre"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Options commande */}
        <div className="border-t pt-5 mt-5">
          <h2 className="text-lg font-semibold mb-4">Options de commande</h2>

          {/* Delivery settings */}
          <div className="rounded-xl border p-4 mb-4 space-y-4">
            <p className="text-sm font-medium">Livraison</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-1">Frais de livraison (€)</label>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  placeholder="ex: 3.99"
                  value={deliveryFee === 0 ? "" : deliveryFee}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-1">Temps min (min)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="ex: 20"
                  value={deliveryTimeMin === 0 ? "" : deliveryTimeMin}
                  onChange={(e) => setDeliveryTimeMin(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-1">Temps max (min)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="ex: 40"
                  value={deliveryTimeMax === 0 ? "" : deliveryTimeMax}
                  onChange={(e) => setDeliveryTimeMax(parseInt(e.target.value) || 0)}
                  className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Affiché au client : <span className="font-medium">{deliveryFee.toFixed(2)} € · {deliveryTimeMin}-{deliveryTimeMax} min</span>
              {freeDeliveryThreshold > 0 && <span className="ml-2 text-green-600 dark:text-green-400">· Gratuit dès {freeDeliveryThreshold.toFixed(2)} €</span>}
            </p>
          </div>

          {/* Free delivery threshold */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Livraison gratuite à partir de (€)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.50"
                min="0"
                placeholder="ex: 15.00"
                value={freeDeliveryThreshold === 0 ? "" : freeDeliveryThreshold}
                onChange={(e) => setFreeDeliveryThreshold(parseFloat(e.target.value) || 0)}
                className="w-40 rounded-xl border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <span className="text-sm text-muted-foreground">
                {freeDeliveryThreshold > 0
                  ? `Livraison gratuite dès ${freeDeliveryThreshold.toFixed(2)} € de commande`
                  : "Désactivé — saisir un montant pour activer"}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div>
                <p className="text-sm font-medium">Restaurant actif</p>
                <p className="text-xs text-muted-foreground">Les clients peuvent passer commande dans ce restaurant</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                className={cn(
                  "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-foreground/20",
                  isActive ? "bg-foreground" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow ring-0 transition-transform duration-200",
                    isActive ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </label>
            <label className="flex items-center justify-between gap-4 rounded-xl border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div>
                <p className="text-sm font-medium">Click &amp; Collect</p>
                <p className="text-xs text-muted-foreground">Permettre aux clients de récupérer leur commande au restaurant</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pickupEnabled}
                onClick={() => setPickupEnabled(!pickupEnabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-foreground/20",
                  pickupEnabled ? "bg-foreground" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow ring-0 transition-transform duration-200",
                    pickupEnabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Notification sound */}
        <div className="border-t pt-5 mt-5">
          <h2 className="text-lg font-semibold mb-1">Son de notification</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Joué automatiquement à chaque nouvelle commande dans le dashboard admin.
          </p>
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted flex-shrink-0">
                <Music size={18} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                {notificationSoundUrl ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">✓ Son configuré</p>
                    <audio controls src={notificationSoundUrl} className="w-full h-8" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun son configuré</p>
                )}
              </div>
              {notificationSoundUrl && (
                <button
                  type="button"
                  onClick={() => setNotificationSoundUrl("")}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <label className={cn(
              "flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-semibold cursor-pointer transition-colors",
              uploadingSound ? "opacity-50 pointer-events-none" : "hover:bg-muted"
            )}>
              {uploadingSound ? (
                <><Loader2 size={14} className="animate-spin" /> Envoi en cours…</>
              ) : (
                <><Volume2 size={14} /> {notificationSoundUrl ? "Remplacer le son" : "Choisir un .mp3"}</>
              )}
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploadingSound(true)
                  try {
                    const url = await uploadAudio(file)
                    setNotificationSoundUrl(url)
                    toast.success("Son uploadé !")
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erreur upload")
                  } finally {
                    setUploadingSound(false)
                    e.target.value = ""
                  }
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">Format : MP3 ou WAV · max 2 Mo</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-3.5 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : "Enregistrer"}
        </button>
      </form>
    </div>
  )
}
