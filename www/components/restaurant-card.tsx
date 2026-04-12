"use client"

import Image from "next/image"
import Link from "next/link"
import { Clock, Star } from "lucide-react"
import type { Restaurant } from "@/lib/restaurant-types"

export function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const image = restaurant.bannerUrl || "/placeholder-restaurant.svg"
  const bannerPos = (() => {
    if (!restaurant.bannerPosition) return { x: 50, y: 50 }
    if (typeof restaurant.bannerPosition === "string") {
      try { return JSON.parse(restaurant.bannerPosition) } catch { return { x: 50, y: 50 } }
    }
    return restaurant.bannerPosition
  })()
  const deliveryFee = restaurant.deliveryFee ?? 0
  const deliveryTime = restaurant.deliveryTime ?? ""
  const rating = restaurant.rating ?? 0

  if (!restaurant.isOpen) {
    return (
      <div className="group block cursor-not-allowed opacity-75">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
          <Image
            src={image}
            alt={restaurant.name}
            fill
            className="object-cover"
            style={{ objectPosition: `${bannerPos.x}% ${bannerPos.y}%` }}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white">
              Fermé
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h3 className="text-lg font-bold">{restaurant.name}</h3>
            <p className="text-sm text-white/80">{restaurant.category}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Link href={`/restaurant/${restaurant.slug}`} className="group block">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
        <Image
          src={image}
          alt={restaurant.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          style={{ objectPosition: `${bannerPos.x}% ${bannerPos.y}%` }}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {restaurant.isNew && (
          <span className="absolute top-3 left-3 rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
            Nouveau
          </span>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <h3 className="text-lg font-bold">{restaurant.name}</h3>
          <p className="text-sm text-white/80">{restaurant.category}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-white/70">
            {rating > 0 && (
              <span className="flex items-center gap-1">
                <Star size={12} fill="currentColor" />
                {rating}
              </span>
            )}
            {deliveryTime && (
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {deliveryTime}
              </span>
            )}
            <span>
              {deliveryFee === 0 ? "Livraison gratuite" : `${deliveryFee.toFixed(2)} € livraison`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
