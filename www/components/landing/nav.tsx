"use client"

import { useEffect, useState } from "react"

const SECTIONS = [
  { id: "manifeste", label: "Manifeste" },
  { id: "modes", label: "Modes" },
  { id: "menu", label: "Menu" },
  { id: "paiements", label: "Paiements" },
  { id: "suivi", label: "Suivi" },
  { id: "details", label: "Détails" },
  { id: "stack", label: "Stack" },
]

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
        scrolled
          ? "bg-[var(--color-paper)]/85 backdrop-blur-xl border-b border-[var(--color-line)]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a
          href="#top"
          className="font-display text-2xl italic leading-none text-[var(--color-ink)]"
        >
          e-snack<span className="text-[var(--color-tomato)]">.</span>
        </a>
        <nav className="hidden items-center gap-8 text-[13px] font-medium tracking-wide text-[var(--color-ink-soft)] md:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="relative transition-colors hover:text-[var(--color-ink)]"
            >
              {s.label}
            </a>
          ))}
        </nav>
        <a
          href="#contact"
          className="group hidden items-center gap-2 rounded-full border border-[var(--color-ink)] bg-[var(--color-ink)] px-5 py-2 text-xs font-semibold text-[var(--color-paper)] transition-all hover:bg-[var(--color-tomato)] hover:border-[var(--color-tomato)] md:inline-flex"
        >
          Lancer une démo
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </a>
      </div>
    </header>
  )
}
