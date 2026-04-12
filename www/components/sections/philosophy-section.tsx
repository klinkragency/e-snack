"use client";

import { useEffect, useState } from "react";
import { RestaurantCard } from "@/components/restaurant-card";
import { listRestaurants } from "@/lib/restaurant-client";
import type { Restaurant } from "@/lib/restaurant-types";
import { Loader2 } from "lucide-react";

export function PhilosophySection() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRestaurants()
      .then(setRestaurants)
      .catch(() => setError("Impossible de charger les restaurants"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="concept" className="bg-background">
      {/* Restaurants Direct Order Section */}
      <div className="px-6 py-12 md:px-12 md:py-16 lg:px-20">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            COMMANDEZ MAINTENANT
          </p>
          <h2 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">
            Vos restaurants préférés
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            Sélectionnez un restaurant et commandez en quelques clics.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {restaurants.map((r) => (
              <RestaurantCard key={r.id} restaurant={r} />
            ))}
          </div>
        )}
      </div>

    </section>
  );
}
