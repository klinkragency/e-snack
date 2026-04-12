"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2 } from "lucide-react"
import { AddressInput } from "@/components/address-input"
import { useAppStore } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { createAddress } from "@/lib/account-client"

export default function OnboardingPage() {
  const router = useRouter()
  const { address, setAddress, user } = useAppStore(
    useShallow((s) => ({ address: s.address, setAddress: s.setAddress, user: s.user }))
  )
  const [value, setValue] = useState(address)
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({})
  const [saving, setSaving] = useState(false)

  const handleAddressChange = (text: string, lat?: number, lng?: number) => {
    setValue(text)
    if (lat != null && lng != null) setCoords({ lat, lng })
  }

  const handleContinue = async () => {
    if (!value.trim()) return
    setSaving(true)

    // Save to Zustand (local state for immediate use)
    setAddress(value)

    // If logged in, also persist to DB as default address
    if (user) {
      try {
        await createAddress({
          label: "Principale",
          address: value.trim(),
          lat: coords.lat,
          lng: coords.lng,
          isDefault: true,
        })
      } catch {
        // Non-blocking: address is still in Zustand for this session
      }
    }

    setSaving(false)
    router.push("/restaurants")
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Où livrer ?</h1>
          <p className="text-sm text-muted-foreground">
            Entrez votre adresse pour voir les restaurants disponibles
          </p>
        </div>

        <AddressInput value={value} onChange={handleAddressChange} />

        <button
          onClick={handleContinue}
          disabled={!value.trim() || saving}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              Voir les restaurants
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
