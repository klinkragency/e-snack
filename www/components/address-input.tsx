"use client"

import { MapPin, Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { mockAddressSuggestions } from "@/lib/mock-data"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ""
const MONACO_BBOX = "7.38,43.72,7.44,43.75" // Monaco bounding box

interface Suggestion {
  label: string
  lat?: number
  lng?: number
}

interface Props {
  value: string
  onChange: (value: string, lat?: number, lng?: number) => void
}

export function AddressInput({ value, onChange }: Props) {
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([])
      return
    }

    // If no Mapbox token, use mock suggestions
    if (!MAPBOX_TOKEN) {
      const filtered = mockAddressSuggestions
        .filter((a) => a.toLowerCase().includes(query.toLowerCase()))
        .map((a) => ({ label: a }))
      setSuggestions(filtered)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&bbox=${MONACO_BBOX}&proximity=7.42,43.73&types=address&limit=5&language=fr`
      )
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSuggestions(
        (data.features || []).map((f: { place_name: string; center: [number, number] }) => ({
          label: f.place_name,
          lng: f.center[0],
          lat: f.center[1],
        }))
      )
    } catch {
      // Fallback to mock on error
      setSuggestions(
        mockAddressSuggestions
          .filter((a) => a.toLowerCase().includes(query.toLowerCase()))
          .map((a) => ({ label: a }))
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value, fetchSuggestions])

  const showSuggestions = focused && suggestions.length > 0

  return (
    <div className="relative">
      <div className="relative">
        <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder="Entrez votre adresse de livraison"
          className="w-full rounded-full border bg-background py-3.5 pl-11 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-foreground/20"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 z-10 mt-2 overflow-hidden rounded-2xl border bg-background shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              onMouseDown={() => {
                onChange(suggestion.label, suggestion.lat, suggestion.lng)
                setFocused(false)
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
            >
              <MapPin size={14} className="text-muted-foreground flex-shrink-0" />
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
