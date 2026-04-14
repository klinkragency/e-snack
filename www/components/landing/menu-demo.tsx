"use client"

import { useEffect, useState } from "react"
import { Reveal } from "./reveal"

type Product = { id: string; name: string; price: number }
type Category = { id: string; name: string; products: Product[] }

const INITIAL: Category[] = [
  {
    id: "c1",
    name: "Entrées",
    products: [
      { id: "p1", name: "Burrata · tomates anciennes", price: 12 },
      { id: "p2", name: "Tartare de saumon, yuzu", price: 14 },
    ],
  },
  {
    id: "c2",
    name: "Plats",
    products: [
      { id: "p3", name: "Risotto aux cèpes", price: 22 },
      { id: "p4", name: "Bavette, sauce au poivre", price: 24 },
      { id: "p5", name: "Poisson du jour", price: 26 },
    ],
  },
  {
    id: "c3",
    name: "Desserts",
    products: [
      { id: "p6", name: "Tiramisu maison", price: 9 },
      { id: "p7", name: "Tarte fine aux pommes", price: 8 },
    ],
  },
]

/** Animates a drag-like reorder of categories every few seconds. Pure JS fake drag. */
export function MenuDemo() {
  return (
    <section
      id="menu"
      className="relative mx-auto max-w-7xl px-6 py-32 md:px-12 md:py-48"
    >
      <Reveal as="p" className="bistro-divider mb-16">
        <span>Menu organisé — chapitre 03</span>
      </Reveal>

      <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <div>
          <Reveal as="h2" className="font-display text-5xl leading-[0.95] md:text-6xl">
            Un menu qui<br />
            se laisse<br />
            <em className="text-[var(--color-tomato)]">construire.</em>
          </Reveal>

          <Reveal as="p" delay={1} className="mt-8 text-lg leading-relaxed text-[var(--color-ink-soft)]">
            Glissez-déposez catégories, produits et formules depuis l&apos;admin.
            Renommez en un clic. Désactivez un plat épuisé sans le supprimer.
            Changez l&apos;ordre selon l&apos;heure du service.
          </Reveal>

          <Reveal as="ul" delay={2} className="mt-10 grid gap-3 text-[15px] text-[var(--color-ink-soft)] sm:grid-cols-2">
            {[
              "Catégories",
              "Produits",
              "Formules / combos",
              "Options à choix",
              "Max-sélections",
              "Allergènes",
              "Photos via MinIO",
              "Disponibilité live",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-2 inline-block h-1 w-3 bg-[var(--color-tomato)]" />
                {item}
              </li>
            ))}
          </Reveal>
        </div>

        <Reveal delay={2}>
          <AnimatedMenu />
        </Reveal>
      </div>
    </section>
  )
}

function AnimatedMenu() {
  const [cats, setCats] = useState<Category[]>(INITIAL)
  const [hoveredCat, setHoveredCat] = useState<string | null>(null)

  // Periodically "rearrange" — swap 2 products within a category for visual life
  useEffect(() => {
    const t = setInterval(() => {
      setCats((prev) => {
        const next = prev.map((c) => ({ ...c, products: [...c.products] }))
        // Rotate first category products by 1
        const firstCat = next[0]
        if (firstCat && firstCat.products.length > 1) {
          firstCat.products.push(firstCat.products.shift()!)
        }
        return next
      })
    }, 3800)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-[0_30px_60px_-30px_rgba(18,16,8,0.15)] md:p-6">
      {/* Fake browser chrome */}
      <div className="mb-4 flex items-center gap-1.5 border-b border-[var(--color-line)] pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-line)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-line)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-line)]" />
        <span className="ml-4 font-mono text-[10px] text-[var(--color-ink-soft)]">
          /admin/restaurants/chez-mario/menu
        </span>
      </div>

      <div className="space-y-3">
        {cats.map((cat, i) => (
          <div
            key={cat.id}
            onMouseEnter={() => setHoveredCat(cat.id)}
            onMouseLeave={() => setHoveredCat(null)}
            className={`rounded-xl border border-[var(--color-line)] transition-all ${
              hoveredCat === cat.id ? "shadow-[0_8px_24px_-12px_rgba(18,16,8,0.2)] scale-[1.01]" : ""
            }`}
          >
            {/* Category header */}
            <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3">
              <GripIcon />
              <h4 className="font-display text-lg leading-none">{cat.name}</h4>
              <span className="ml-auto font-mono text-[10px] text-[var(--color-ink-soft)]">
                {cat.products.length} prod.
              </span>
            </div>
            {/* Products */}
            <ul className="divide-y divide-[var(--color-line)]">
              {cat.products.map((p, j) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-[var(--color-paper)]"
                  style={{
                    animation: j === 0 && i === 0 ? "charIn 500ms ease-out" : undefined,
                  }}
                >
                  <GripIcon small />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="font-mono text-xs text-[var(--color-ink-soft)]">
                    {p.price.toFixed(2)} €
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 font-mono text-[10px] leading-relaxed text-[var(--color-ink-soft)]">
        ↕ drag n&apos; drop sur toutes les lignes · persistance auto · <span className="text-[var(--color-tomato)]">● live</span>
      </p>
    </div>
  )
}

function GripIcon({ small }: { small?: boolean }) {
  const s = small ? 10 : 14
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden>
      <g fill="currentColor" className="text-[var(--color-ink-soft)] opacity-40">
        <circle cx="6" cy="3" r="1" />
        <circle cx="10" cy="3" r="1" />
        <circle cx="6" cy="8" r="1" />
        <circle cx="10" cy="8" r="1" />
        <circle cx="6" cy="13" r="1" />
        <circle cx="10" cy="13" r="1" />
      </g>
    </svg>
  )
}
